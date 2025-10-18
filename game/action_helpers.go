package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

// CanPlayerAct checks if a player is off cooldown and returns their data.
// It fetches player data and checks their 'nextActionAt' timestamp.
func CanPlayerAct(playerID string) (bool, map[string]string) {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Failed to get player data for %s: %v", playerID, err)
		return false, nil
	}

	nextActionAt, _ := strconv.ParseInt(playerData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return false, playerData // On cooldown
	}

	return true, playerData
}

// GetPlayerPosition parses X and Y coordinates from player data.
func GetPlayerPosition(playerData map[string]string) (int, int) {
	x, _ := strconv.Atoi(playerData["x"])
	y, _ := strconv.Atoi(playerData["y"])
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
	tileJSON, err := rdb.HGet(ctx, "world:zone:0", coordKey).Result()
	if err != nil {
		return nil, nil, err
	}

	var tile models.WorldTile
	if err := json.Unmarshal([]byte(tileJSON), &tile); err != nil {
		log.Printf("Failed to unmarshal tile at %s: %v", coordKey, err)
		return nil, nil, err
	}

	props, ok := TileDefs[tile.Type]
	if !ok {
		log.Printf("Unknown tile type %s at %s", tile.Type, coordKey)
		// Fallback to ground properties to be safe
		props = TileDefs["ground"]
	}

	return &tile, &props, nil
}

// PublishUpdate sends a message to the Redis world_updates channel for broadcasting.
func PublishUpdate(message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling message for publish: %v", err)
		return
	}
	rdb.Publish(ctx, "world_updates", string(jsonMsg))
}
