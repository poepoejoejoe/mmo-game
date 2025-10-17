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
func FindOpenSpawnPoint(playerID string) (int, int) {
	x, y, dx, dy := 0, 0, 0, -1
	for i := 0; i < (WorldSize * 2); i++ {
		for j := 0; j < (i/2 + 1); j++ {
			tileKey := "lock:tile:" + strconv.Itoa(x) + "," + strconv.Itoa(y)
			wasSet, _ := rdb.SetNX(ctx, tileKey, playerID, 0).Result()
			if wasSet {
				tileJSON, err := rdb.HGet(ctx, "world:zone:0", strconv.Itoa(x)+","+strconv.Itoa(y)).Result()
				if err != nil {
					continue
				}
				var tile models.WorldTile
				json.Unmarshal([]byte(tileJSON), &tile)

				if tile.Type != "rock" && tile.Type != "tree" {
					log.Printf("Found open spawn for %s at (%d, %d)", playerID, x, y)
					return x, y
				}
			}
			x, y = x+dx, y+dy
		}
		dx, dy = -dy, dx
	}
	log.Printf("Could not find open spawn point, defaulting to (0,0) for player %s", playerID)
	return 0, 0
}

// InitializePlayer sets up a new player's state in Redis and prepares the initial welcome message.
func InitializePlayer(playerID string) *models.InitialStateMessage {
	log.Printf("Initializing player %s.", playerID)
	spawnX, spawnY := FindOpenSpawnPoint(playerID)
	inventoryKey := "player:inventory:" + playerID

	pipe := rdb.Pipeline()
	// Set the player's position and initial action cooldown.
	pipe.HSet(ctx, playerID, "x", spawnX, "y", spawnY, "nextActionAt", time.Now().UnixMilli())
	// Add the player to the geospatial index for proximity queries.
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{Name: playerID, Longitude: float64(spawnX), Latitude: float64(spawnY)})

	// --- THIS IS THE CHANGE ---
	// For testing purposes, give every new player a starting inventory.
	// HSet can take multiple field-value pairs at once.
	pipe.HSet(ctx, inventoryKey, "wood", 100, "wooden_wall", 10)
	// --- END OF CHANGE ---

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

	worldDataRaw, _ := rdb.HGetAll(ctx, "world:zone:0").Result()
	worldDataTyped := make(map[string]models.WorldTile)
	for coord, tileJSON := range worldDataRaw {
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)
		worldDataTyped[coord] = tile
	}

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
func CleanupPlayer(playerID string) {
	log.Printf("Cleaning up player %s.", playerID)
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err == nil {
		currentX, _ := strconv.Atoi(playerData["x"])
		currentY, _ := strconv.Atoi(playerData["y"])
		currentTileKey := "lock:tile:" + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
		releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, playerID)
	}

	pipe := rdb.Pipeline()
	pipe.Del(ctx, playerID)
	pipe.ZRem(ctx, "zone:0:positions", playerID)
	// Also delete the player's inventory on cleanup
	pipe.Del(ctx, "player:inventory:"+playerID)
	pipe.Exec(ctx)

	leftMsg := map[string]interface{}{"type": "player_left", "playerId": playerID}
	PublishUpdate(leftMsg)
}
