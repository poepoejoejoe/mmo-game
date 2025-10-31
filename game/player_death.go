package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

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

	spawnX, spawnY := SpawnPlayer(playerID, playerData)

	// Lock the new spawn tile
	LockTileForEntity(playerID, spawnX, spawnY)

	// Reset health and set new position in Redis
	pipe := rdb.Pipeline()
	maxHealth := PlayerDefs.MaxHealth
	pipe.HSet(ctx, playerID, 
		"x", spawnX, 
		"y", spawnY,
		"health", maxHealth, // Reset health to max
		"nextActionAt", time.Now().UnixMilli(), // Reset cooldown
	)

	// --- Player position in Geo set ---
	lon, lat := NormalizeCoords(spawnX, spawnY)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      playerID,
		Longitude: lon,
		Latitude:  lat,
	})

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error respawning player %s: %v", playerID, err)
		return
	}

	// Send EntityJoined message to ensure client properly sees the player after respawn
	// This is better than EntityMoved because it ensures the client knows the player exists
	playerDataAfterRespawn, _ := rdb.HGetAll(ctx, playerID).Result()
	gear, _ := GetGear(playerID)
	
	joinMsg := map[string]interface{}{
		"type":       string(ServerEventEntityJoined),
		"entityId":   playerID,
		"id":         playerID,
		"x":          spawnX,
		"y":          spawnY,
		"entityType": string(EntityTypePlayer),
		"shirtColor": playerDataAfterRespawn["shirtColor"],
		"gear":       gear,
	}
	PublishUpdate(joinMsg)

	// Also send EntityMoved for position update
	updateMsg := map[string]interface{}{
		"type":     string(ServerEventEntityMoved),
		"entityId": playerID,
		"x":        spawnX,
		"y":        spawnY,
	}
	PublishUpdate(updateMsg)

	// Send health update message to the client
	statsUpdateMsg := models.PlayerStatsUpdateMessage{
		Type:      string(ServerEventPlayerStatsUpdate),
		Health:    &maxHealth,
		MaxHealth: &maxHealth,
	}
	statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)

	// Send direct message to ensure client receives the update
	if sendDirectMessage != nil {
		sendDirectMessage(playerID, statsUpdateJSON)
	}
}
