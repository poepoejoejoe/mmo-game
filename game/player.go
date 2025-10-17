package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// FindOpenSpawnPoint starts at (0,0) and spirals outwards to find an empty, walkable tile.
// It atomically claims the tile lock for the spawning player.
func FindOpenSpawnPoint(playerID string) (int, int) {
	x, y, dx, dy := 0, 0, 0, -1
	// Spiral outwards for a reasonable distance to find a spawn point.
	for i := 0; i < (WorldSize * 2); i++ {
		for j := 0; j < (i/2 + 1); j++ {
			tileKey := "lock:tile:" + strconv.Itoa(x) + "," + strconv.Itoa(y)
			// Atomically try to claim this tile with no expiration.
			wasSet, _ := rdb.SetNX(ctx, tileKey, playerID, 0).Result()
			if wasSet {
				// We got the lock, now double-check that the terrain is valid.
				terrainType, _ := rdb.HGet(ctx, "world:zone:0", strconv.Itoa(x)+","+strconv.Itoa(y)).Result()
				if terrainType != "rock" && terrainType != "tree" {
					log.Printf("Found open spawn for %s at (%d, %d)", playerID, x, y)
					return x, y
				}
			}
			x, y = x+dx, y+dy
		}
		// Rotate the direction of the spiral.
		dx, dy = -dy, dx
	}
	// Fallback to 0,0 if the world is somehow completely full.
	log.Printf("Could not find open spawn point, defaulting to (0,0) for player %s", playerID)
	return 0, 0
}

// InitializePlayer sets up a new player's state in Redis and prepares the initial welcome message.
// It returns the InitialStateMessage to be sent to the connecting client.
func InitializePlayer(playerID string) *models.InitialStateMessage {
	log.Printf("Initializing player %s.", playerID)
	spawnX, spawnY := FindOpenSpawnPoint(playerID)
	inventoryKey := "player:inventory:" + playerID

	pipe := rdb.Pipeline()
	// Set the player's position and initial action cooldown.
	pipe.HSet(ctx, playerID, "x", spawnX, "y", spawnY, "nextActionAt", time.Now().UnixMilli())
	// Add the player to the geospatial index for proximity queries.
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{Name: playerID, Longitude: float64(spawnX), Latitude: float64(spawnY)})
	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		return nil
	}

	// Gather all data needed for the initial state message.
	locations, _ := rdb.GeoRadius(ctx, "zone:0:positions", 0, 0, &redis.GeoRadiusQuery{Radius: 99999, Unit: "km", WithCoord: true}).Result()
	allPlayersState := make(map[string]models.PlayerState)
	for _, loc := range locations {
		allPlayersState[loc.Name] = models.PlayerState{X: int(loc.Longitude), Y: int(loc.Latitude)}
	}
	// --- THIS IS THE FIX ---
	// 1. Fetch the raw map of strings from Redis.
	worldDataRaw, _ := rdb.HGetAll(ctx, "world:zone:0").Result()
	// 2. Create a new, correctly-typed map.
	worldDataTyped := make(map[string]models.WorldTile)
	// 3. Loop through the raw data, unmarshal each JSON string into a struct, and add it to the new map.
	for coord, tileJSON := range worldDataRaw {
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)
		worldDataTyped[coord] = tile
	}
	// --- END OF FIX ---
	inventoryData, _ := rdb.HGetAll(ctx, inventoryKey).Result()

	// Construct the welcome message.
	initialState := &models.InitialStateMessage{
		Type:      "initial_state",
		PlayerId:  playerID,
		Players:   allPlayersState,
		World:     worldDataTyped,
		Inventory: inventoryData,
	}

	// Announce the new player's arrival to everyone else.
	joinMsg := map[string]interface{}{"type": "player_joined", "playerId": playerID, "x": spawnX, "y": spawnY}
	PublishUpdate(joinMsg)

	return initialState
}

// CleanupPlayer removes a player's data and their tile lock from Redis.
// This is critical for preventing orphaned data and locks.
func CleanupPlayer(playerID string) {
	log.Printf("Cleaning up player %s.", playerID)
	// Get the player's last known position to release their tile lock.
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err == nil {
		currentX, _ := strconv.Atoi(playerData["x"])
		currentY, _ := strconv.Atoi(playerData["y"])
		currentTileKey := "lock:tile:" + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
		// Use the safe Lua script to release the lock only if we still own it.
		releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, playerID)
	}

	// Remove the player's data hash and their entry from the geospatial index.
	pipe := rdb.Pipeline()
	pipe.Del(ctx, playerID)
	pipe.ZRem(ctx, "zone:0:positions", playerID)
	pipe.Exec(ctx)

	// Announce the player's departure to everyone else.
	leftMsg := map[string]interface{}{"type": "player_left", "playerId": playerID}
	PublishUpdate(leftMsg)
}
