package main

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var ctx = context.Background()

// --- Redis Client ---
var rdb *redis.Client

// --- WebSocket Upgrader ---
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// --- Client Management ---
type Client struct {
	ID   string
	Conn *websocket.Conn
}

type ClientManager struct {
	clients map[string]*Client
	mu      sync.Mutex
}

func (cm *ClientManager) Add(client *Client) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.clients[client.ID] = client
}

func (cm *ClientManager) Remove(id string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	delete(cm.clients, id)
}

var manager = ClientManager{
	clients: make(map[string]*Client),
}

// --- Constants ---
const (
	WaterMovePenalty = 500 * time.Millisecond
	BaseMoveCooldown = 100 * time.Millisecond
	WorldSize        = 50 // Generates a world from -50 to +50
)

// --- Message Structs ---
type WebSocketMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type MovePayload struct {
	Direction string `json:"direction"`
}

type PlayerState struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type InitialStateMessage struct {
	Type     string                 `json:"type"`
	PlayerId string                 `json:"playerId"`
	Players  map[string]PlayerState `json:"players"`
	World    map[string]string      `json:"world"`
}

func generateWorld() {
	log.Println("Generating world terrain...")
	worldKey := "world:zone:0"

	// Check if world already exists to avoid regeneration on restart
	if rdb.Exists(ctx, worldKey).Val() > 0 {
		log.Println("World already exists in Redis. Skipping generation.")
		return
	}

	pipe := rdb.Pipeline()
	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
			noise := rand.Float64()
			var terrainType string
			if noise > 0.95 {
				terrainType = "rock"
			} else if noise > 0.90 {
				terrainType = "tree"
			} else if noise > 0.88 {
				terrainType = "water"
			} else {
				terrainType = "ground"
			}
			pipe.HSet(ctx, worldKey, coordKey, terrainType)
		}
	}
	// Ensure spawn point is clear
	pipe.HSet(ctx, worldKey, "0,0", "ground")

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world: %v", err)
	}
	log.Println("World generation complete.")
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	playerID := "player:" + uuid.New().String()
	client := &Client{ID: playerID, Conn: conn}
	manager.Add(client)
	log.Printf("Player %s connected.", playerID)

	spawnX, spawnY := 0, 0
	playerKey := playerID

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerKey, "x", spawnX, "y", spawnY, "canMoveAt", time.Now().UnixMilli())
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{
		Name:      playerKey,
		Longitude: float64(spawnX),
		Latitude:  float64(spawnY),
	})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		conn.Close()
		return
	}

	// --- Send initial state to the new player ---
	locations, err := rdb.GeoRadius(ctx, "zone:0:positions", float64(spawnX), float64(spawnY), &redis.GeoRadiusQuery{
		Radius:    99999,
		Unit:      "km",
		WithCoord: true,
	}).Result()
	if err != nil {
		log.Printf("Error getting players for initial state: %v", err)
	}

	allPlayersState := make(map[string]PlayerState)
	for _, loc := range locations {
		allPlayersState[loc.Name] = PlayerState{X: int(loc.Longitude), Y: int(loc.Latitude)}
	}

	// Fetch world data for the viewport
	worldData, err := rdb.HGetAll(ctx, "world:zone:0").Result()
	if err != nil {
		log.Printf("Could not fetch world data: %v", err)
	}

	initialState := InitialStateMessage{
		Type:     "initial_state",
		PlayerId: playerID,
		Players:  allPlayersState,
		World:    worldData,
	}

	if err := client.Conn.WriteJSON(initialState); err != nil {
		log.Printf("Error sending initial state: %v", err)
	}

	// Broadcast that a new player has joined
	joinMsg := map[string]interface{}{
		"type":     "player_joined",
		"playerId": playerID,
		"x":        spawnX,
		"y":        spawnY,
	}
	jsonMsg, _ := json.Marshal(joinMsg)
	rdb.Publish(ctx, "world_updates", string(jsonMsg))

	go handleIncomingMessages(client)
}

func handleIncomingMessages(client *Client) {
	defer func() {
		manager.Remove(client.ID)
		rdb.Del(ctx, client.ID)
		rdb.ZRem(ctx, "zone:0:positions", client.ID)

		leftMsg := map[string]interface{}{"type": "player_left", "playerId": client.ID}
		jsonMsg, _ := json.Marshal(leftMsg)
		rdb.Publish(ctx, "world_updates", string(jsonMsg))

		log.Printf("Player %s disconnected.", client.ID)
		client.Conn.Close()
	}()

	for {
		_, message, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Read error for player %s: %v", client.ID, err)
			}
			break
		}

		var msg WebSocketMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshalling message: %v", err)
			continue
		}

		if msg.Type == "move" {
			processMove(client, msg.Payload)
		}
	}
}

func processMove(client *Client, payload json.RawMessage) {
	var moveData MovePayload
	if err := json.Unmarshal(payload, &moveData); err != nil {
		log.Printf("Error unmarshalling move payload: %v", err)
		return
	}

	// --- Movement Validation Logic ---
	playerData, err := rdb.HGetAll(ctx, client.ID).Result()
	if err != nil {
		log.Printf("Could not get data for player %s", client.ID)
		return
	}

	canMoveAt, _ := strconv.ParseInt(playerData["canMoveAt"], 10, 64)
	if time.Now().UnixMilli() < canMoveAt {
		return // Player is on cooldown
	}

	currentX, _ := strconv.Atoi(playerData["x"])
	currentY, _ := strconv.Atoi(playerData["y"])

	targetX, targetY := currentX, currentY
	switch moveData.Direction {
	case "up":
		targetY--
	case "down":
		targetY++
	case "left":
		targetX--
	case "right":
		targetX++
	}

	// Check terrain for collision
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)
	terrainType, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
	if err != nil {
		terrainType = "void" // Treat unknown space as a wall
	}

	if terrainType == "rock" || terrainType == "tree" || terrainType == "void" {
		return // Invalid move, collision
	}

	// Apply movement penalty/cooldown
	var nextMoveTime int64
	if terrainType == "water" {
		nextMoveTime = time.Now().Add(WaterMovePenalty).UnixMilli()
	} else {
		nextMoveTime = time.Now().Add(BaseMoveCooldown).UnixMilli()
	}

	// Update player state in Redis
	pipe := rdb.Pipeline()
	pipe.HSet(ctx, client.ID, "x", targetX, "y", targetY, "canMoveAt", nextMoveTime)
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{
		Name:      client.ID,
		Longitude: float64(targetX),
		Latitude:  float64(targetY),
	})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating player %s position in Redis: %v", client.ID, err)
		return
	}

	// Broadcast the successful move
	updateMsg := map[string]interface{}{
		"type":     "player_moved",
		"playerId": client.ID,
		"x":        targetX,
		"y":        targetY,
	}
	jsonMsg, _ := json.Marshal(updateMsg)
	rdb.Publish(ctx, "world_updates", string(jsonMsg))
}

func broadcastUpdates() {
	pubsub := rdb.Subscribe(ctx, "world_updates")
	defer pubsub.Close()
	ch := pubsub.Channel()

	for msg := range ch {
		manager.mu.Lock()
		for _, client := range manager.clients {
			// A simple optimization: don't send move updates back to the sender
			// as they have client-side prediction. This can be more complex
			// if you need to correct their position.
			var updateData map[string]interface{}
			json.Unmarshal([]byte(msg.Payload), &updateData)
			if updateData["type"] == "player_moved" && updateData["playerId"] == client.ID {
				// continue
			}

			err := client.Conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload))
			if err != nil {
				log.Printf("Write error for client %s: %v", client.ID, err)
			}
		}
		manager.mu.Unlock()
	}
}

func main() {
	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	log.Println("Successfully connected to Redis.")

	rand.Seed(time.Now().UnixNano())
	generateWorld()

	http.HandleFunc("/ws", handleWebSocket)
	http.Handle("/", http.FileServer(http.Dir("./")))
	go broadcastUpdates()

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
