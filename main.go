package main

import (
	"context"
	"encoding/json"
	"log"
	"mmo-game/game"
	"net/http"
	_ "net/http/pprof" // Import for performance profiling
	"os"
	"os/signal"
	"syscall"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
)

var rdb *redis.Client

// HubInst is a global instance of the Hub.
var HubInst *Hub

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	id   string
	send chan []byte
}

func nukeServerState() {
	log.Println("Nuking ALL player data and tile locks from Redis...")
	ctx := context.Background()
	rdb.FlushAll(ctx)
	log.Println("Redis flushed.")
}

// cleanupServerState now uses the non-blocking SCAN command to find all locks.
func cleanupServerState() {
	log.Println("Cleaning up ALL player data and tile locks from Redis...")
	ctx := context.Background()

	// --- NEW: Use SCAN to find all tile locks iteratively ---
	var allLockKeys []string
	var cursor uint64
	scanCount := int64(100) // How many keys to check per iteration

	for {
		// Scan for a batch of keys matching the pattern
		keys, nextCursor, err := rdb.Scan(ctx, cursor, "lock:tile:*", scanCount).Result()
		if err != nil {
			log.Printf("Error during Redis SCAN for lock keys: %v", err)
			break // Exit the loop on error
		}
		// Add the found keys to our list
		allLockKeys = append(allLockKeys, keys...)

		// If the next cursor is 0, we've finished iterating
		if nextCursor == 0 {
			break
		}
		// Otherwise, update the cursor for the next iteration
		cursor = nextCursor
	}
	// --- End of SCAN loop ---

	// Find all active player IDs from the geospatial index
	playerKeys, err := rdb.ZRange(ctx, "zone:0:positions", 0, -1).Result()
	if err != nil {
		log.Printf("Could not get player keys for cleanup: %v", err)
	}

	// Check if there's anything to do
	if len(playerKeys) == 0 && len(allLockKeys) == 0 {
		log.Println("No active players or locks found to clean up.")
		return
	}

	log.Printf("Found %d players and %d tile locks to remove.", len(playerKeys), len(allLockKeys))

	pipe := rdb.Pipeline()

	// Add the main geospatial index to the deletion list
	pipe.Del(ctx, "zone:0:positions")

	// Add all found player hashes to the deletion list
	for _, playerKey := range playerKeys {
		pipe.Del(ctx, playerKey)
	}

	// Add all found lock keys to the deletion list
	if len(allLockKeys) > 0 {
		pipe.Del(ctx, allLockKeys...)
	}

	// Execute all deletion commands
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error during Redis cleanup pipeline: %v", err)
	} else {
		log.Println("Redis cleanup successful. All player data and locks removed.")
	}
}

func main() {
	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	if _, err := rdb.Ping(context.Background()).Result(); err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}
	log.Println("Successfully connected to Redis.")

	HubInst = newHub()
	go HubInst.run()

	isPlayerOnline := func(playerID string) bool {
		_, ok := HubInst.clients[playerID]
		return ok
	}
	game.Init(rdb, SendDirectMessage, isPlayerOnline)
	game.GenerateWorld()
	game.IndexWorldResources()
	// --- For Testing: Spawn some NPCs ---
	// game.SpawnNPC("npc:slime:"+utils.GenerateUniqueID(), 1, 2, game.NPCTypeSlime)
	// game.SpawnNPC("npc:rat:"+utils.GenerateUniqueID(), -2, -3, game.NPCTypeRat)

	// Start the game loops
	go game.StartAILoop()
	go game.StartSpawnerLoop()
	go game.StartDamageSystem()
	go game.StartDecaySystem()

	go subscribeToWorldUpdates()

	// Configure websocket route
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(HubInst, w, r)
	})
	http.Handle("/", http.FileServer(http.Dir("./")))

	go func() {
		log.Println("Server starting on :8080")
		if err := http.ListenAndServe(":8080", nil); err != nil {
			log.Fatal("ListenAndServe:", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutdown signal received, cleaning up...")
	// clean up server state but persist
	// cleanupServerState()

	// used to reset the server completely
	nukeServerState()

	log.Println("Server gracefully stopped.")
}

// subscribeToWorldUpdates listens to the Redis "world_updates" channel,
// inspects messages, and routes them to the hub appropriately.
func subscribeToWorldUpdates() {
	ctx := context.Background()
	pubsub := rdb.Subscribe(ctx, "world_updates")
	defer pubsub.Close()
	ch := pubsub.Channel()

	for msg := range ch {
		// Attempt to decode the message to see if it's a private message
		var privateMsg struct {
			IsPrivate bool            `json:"__private_message"`
			TargetID  string          `json:"targetId"`
			Payload   json.RawMessage `json:"payload"`
		}

		// Try to unmarshal into the private message structure
		if err := json.Unmarshal([]byte(msg.Payload), &privateMsg); err == nil && privateMsg.IsPrivate {
			// It's a private message, send it directly to the target client
			SendDirectMessage(privateMsg.TargetID, []byte(privateMsg.Payload))
		} else {
			// It's a public broadcast message, send to all clients
			HubInst.broadcast <- []byte(msg.Payload)
		}
	}
}

func SendDirectMessage(playerID string, message []byte) {
	if client, ok := HubInst.clients[playerID]; ok {
		client.send <- message
	}
}
