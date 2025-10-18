package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

func FindOpenSpawnPoint(playerID string) (int, int) {
	x, y, dx, dy := 0, 0, 0, -1
	for i := 0; i < (WorldSize * 2); i++ {
		for j := 0; j < (i/2 + 1); j++ {
			// Use RedisKey constant
			tileKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
			wasSet, _ := rdb.SetNX(ctx, tileKey, playerID, 0).Result()
			if wasSet {
				// Use RedisKey constant
				tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), strconv.Itoa(x)+","+strconv.Itoa(y)).Result()
				if err != nil {
					continue
				}
				var tile models.WorldTile
				json.Unmarshal([]byte(tileJSON), &tile)

				// Use TileType constant
				props := TileDefs[TileType(tile.Type)]
				if !props.IsCollidable {
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
	// Use RedisKey constant
	inventoryKey := string(RedisKeyPlayerInventory) + playerID

	pipe := rdb.Pipeline()
	// Set the player's position and initial action cooldown.
	pipe.HSet(ctx, playerID, "x", spawnX, "y", spawnY, "nextActionAt", time.Now().UnixMilli())
	// Add the player to the geospatial index for proximity queries.
	// Use RedisKey constant
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{Name: playerID, Longitude: float64(spawnX), Latitude: float64(spawnY)})

	// --- THIS IS THE CHANGE ---
	// For testing purposes, give every new player a starting inventory.
	// HSet can take multiple field-value pairs at once.
	// Use ItemType constants
	pipe.HSet(ctx, inventoryKey, string(ItemWood), 100, string(ItemWoodenWall), 10)
	// --- END OF CHANGE ---

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		return nil
	}

	// Gather all data needed for the initial state message.
	// Use RedisKey constant
	locations, _ := rdb.GeoRadius(ctx, string(RedisKeyZone0Positions), 0, 0, &redis.GeoRadiusQuery{Radius: 99999, Unit: "km", WithCoord: true}).Result()
	allPlayersState := make(map[string]models.PlayerState)
	for _, loc := range locations {
		allPlayersState[loc.Name] = models.PlayerState{X: int(loc.Longitude), Y: int(loc.Latitude)}
	}

	// Use RedisKey constant
	worldDataRaw, _ := rdb.HGetAll(ctx, string(RedisKeyWorldZone0)).Result()
	worldDataTyped := make(map[string]models.WorldTile)
	for coord, tileJSON := range worldDataRaw {
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)
		worldDataTyped[coord] = tile
	}

	inventoryData, _ := rdb.HGetAll(ctx, inventoryKey).Result()

	// Construct the welcome message.
	// Use ServerEventType constant
	initialState := &models.InitialStateMessage{
		Type:      string(ServerEventInitialState),
		PlayerId:  playerID,
		Players:   allPlayersState,
		World:     worldDataTyped,
		Inventory: inventoryData,
	}

	// Announce the new player's arrival to everyone else.
	// Use ServerEventType constant
	joinMsg := map[string]interface{}{"type": string(ServerEventPlayerJoined), "playerId": playerID, "x": spawnX, "y": spawnY}
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
		// Use RedisKey constant
		currentTileKey := string(RedisKeyLockTile) + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
		releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, playerID)
	}

	pipe := rdb.Pipeline()
	pipe.Del(ctx, playerID)
	// Use RedisKey constant
	pipe.ZRem(ctx, string(RedisKeyZone0Positions), playerID)
	// Also delete the player's inventory on cleanup
	// Use RedisKey constant
	pipe.Del(ctx, string(RedisKeyPlayerInventory)+playerID)
	pipe.Exec(ctx)

	// Use ServerEventType constant
	leftMsg := map[string]interface{}{"type": string(ServerEventPlayerLeft), "playerId": playerID}
	PublishUpdate(leftMsg)
}
