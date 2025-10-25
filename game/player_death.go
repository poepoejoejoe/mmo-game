package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"

	"github.com/go-redis/redis/v8"
)

// HandlePlayerDeath resets the player's health and moves them to a new spawn point.
func HandlePlayerDeath(playerID string) {
	log.Printf("Player %s has been defeated.", playerID)

	// Get the player's current data to release their tile lock
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Could not get player data for death handling: %v", err)
		// Continue anyway, try to respawn them
	} else {
		currentX, _ := strconv.Atoi(playerData["x"])
		currentY, _ := strconv.Atoi(playerData["y"])
		UnlockTileForEntity(playerID, currentX, currentY)
	}

	// Find a new spawn point for the player
	spawnX, spawnY := FindOpenSpawnPoint(playerID)

	// Lock the new spawn tile
	LockTileForEntity(playerID, spawnX, spawnY)

	// Reset health and set new position in Redis
	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "health", PlayerDefs.MaxHealth, "x", spawnX, "y", spawnY)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      playerID,
		Longitude: float64(spawnX),
		Latitude:  float64(spawnY),
	})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error respawning player %s: %v", playerID, err)
		return
	}

	// Announce the player's "move" to the new spawn point
	updateMsg := map[string]interface{}{
		"type":     string(ServerEventEntityMoved),
		"entityId": playerID,
		"x":        spawnX,
		"y":        spawnY,
	}
	PublishUpdate(updateMsg)

	// Send a message to the client to update their health UI
	statsUpdateMsg := models.PlayerStatsUpdateMessage{
		Type:      string(ServerEventPlayerStatsUpdate),
		Health:    PlayerDefs.MaxHealth,
		MaxHealth: PlayerDefs.MaxHealth,
	}
	statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)

	// This is a bit of a hack. We're looking up the client in the hub
	// to send them a direct message. A better approach might be a dedicated
	// channel for per-client messages from the game logic.
	if sendDirectMessage != nil {
		sendDirectMessage(playerID, statsUpdateJSON)
	}
}
