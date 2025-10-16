package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

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

// --- Message Structs ---
type WebSocketMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type MovePayload struct {
	Direction string `json:"direction"`
}

// --- NEW: Structs for initial state message ---
type PlayerState struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type InitialStateMessage struct {
	Type     string                 `json:"type"`
	PlayerId string                 `json:"playerId"`
	Players  map[string]PlayerState `json:"players"`
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

	spawnX, spawnY := 0.0, 0.0
	playerKey := playerID

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerKey, "x", spawnX, "y", spawnY)
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{
		Name:      playerKey,
		Longitude: spawnX,
		Latitude:  spawnY,
	})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		conn.Close()
		return
	}

	// --- START FIX: Send initial state to the new player ---

	// 1. Get all players in the zone
	locations, err := rdb.GeoRadius(ctx, "zone:0:positions", 0, 0, &redis.GeoRadiusQuery{
		Radius:    99999, // A huge radius to get everyone
		Unit:      "km",
		WithCoord: true,
	}).Result()
	if err != nil {
		log.Printf("Error getting players for initial state: %v", err)
	}

	// 2. Build the current players map
	allPlayersState := make(map[string]PlayerState)
	for _, loc := range locations {
		allPlayersState[loc.Name] = PlayerState{X: loc.Longitude, Y: loc.Latitude}
	}

	// 3. Create and send the initial state message
	initialState := InitialStateMessage{
		Type:     "initial_state",
		PlayerId: playerID,
		Players:  allPlayersState,
	}

	// Use WriteJSON for convenience, it handles marshalling
	if err := client.Conn.WriteJSON(initialState); err != nil {
		log.Printf("Error sending initial state: %v", err)
		// Don't return, still want to try broadcasting join
	}

	// --- END FIX ---

	// --- START FIX 2: Broadcast that a new player has joined ---

	joinMsg := map[string]interface{}{
		"type":     "player_joined",
		"playerId": playerID,
		"x":        spawnX,
		"y":        spawnY,
	}
	jsonMsg, _ := json.Marshal(joinMsg)
	rdb.Publish(ctx, "world_updates", string(jsonMsg))

	// --- END FIX 2 ---

	go handleIncomingMessages(client)
}

func handleIncomingMessages(client *Client) {
	defer func() {
		manager.Remove(client.ID)
		rdb.Del(ctx, client.ID)
		rdb.ZRem(ctx, "zone:0:positions", client.ID)

		// Broadcast that the player has left
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

	// Using HGetAll for simplicity, as we need to parse from string anyway
	vals, err := rdb.HGetAll(ctx, client.ID).Result()
	if err != nil {
		log.Printf("Could not get coords for player %s", client.ID)
		return
	}

	var x, y float64
	json.Unmarshal([]byte(vals["x"]), &x)
	json.Unmarshal([]byte(vals["y"]), &y)

	switch moveData.Direction {
	case "up":
		y--
	case "down":
		y++
	case "left":
		x--
	case "right":
		x++
	}

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, client.ID, "x", x, "y", y)
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{
		Name:      client.ID,
		Longitude: x,
		Latitude:  y,
	})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating player %s position in Redis: %v", client.ID, err)
		return
	}

	updateMsg := map[string]interface{}{
		"type":     "player_moved",
		"playerId": client.ID,
		"x":        x,
		"y":        y,
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

	http.HandleFunc("/ws", handleWebSocket)
	http.Handle("/", http.FileServer(http.Dir("./")))
	go broadcastUpdates()

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
