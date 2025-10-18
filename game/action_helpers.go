package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

// --- RENAMED ---
// CanEntityAct checks if an entity is off cooldown and returns their data.
// It fetches entity data and checks their 'nextActionAt' timestamp.
func CanEntityAct(entityID string) (bool, map[string]string) {
	entityData, err := rdb.HGetAll(ctx, entityID).Result()
	if err != nil {
		log.Printf("Failed to get entity data for %s: %v", entityID, err)
		return false, nil
	}

	nextActionAt, _ := strconv.ParseInt(entityData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return false, entityData // On cooldown
	}

	return true, entityData
}

// --- RENAMED ---
// GetEntityPosition parses X and Y coordinates from entity data.
func GetEntityPosition(entityData map[string]string) (int, int) {
	x, _ := strconv.Atoi(entityData["x"])
	y, _ := strconv.Atoi(entityData["y"])
	return x, y
}

// IsAdjacent checks if (x1, y1) is cardinally adjacent to (x2, y2).
func IsAdjacent(x1, y1, x2, y2 int) bool {
	dx := (x1 - x2)
	dy := (y1 - y2)
	distSq := (dx * dx) + (dy * dy)
	return distSq == 1
}

// GetWorldTile fetches a tile from Redis and unmarshals it and its properties.
func GetWorldTile(x, y int) (*models.WorldTile, *TileProperties, error) {
	coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
	// Use RedisKey constant
	tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), coordKey).Result()
	if err != nil {
		return nil, nil, err
	}

	var tile models.WorldTile
	if err := json.Unmarshal([]byte(tileJSON), &tile); err != nil {
		log.Printf("Failed to unmarshal tile at %s: %v", coordKey, err)
		return nil, nil, err
	}

	// --- BUG FIX ---
	// Cast tile.Type string to TileType for map lookup
	props, ok := TileDefs[TileType(tile.Type)]
	if !ok {
		log.Printf("Unknown tile type %s at %s", tile.Type, coordKey)
		// Fallback to ground properties to be safe
		props = TileDefs[TileTypeGround]
	}
	// --- END BUG FIX ---

	return &tile, &props, nil
}

// PublishUpdate sends a message to the Redis world_updates channel for broadcasting.
func PublishUpdate(message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling message for publish: %v", err)
		return
	}
	// Use Redis topic constant (if you add one, e.g., "world_updates")
	rdb.Publish(ctx, "world_updates", string(jsonMsg))
}
