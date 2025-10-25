package game

import (
	"log"
	"strconv"
)

// CleanupEntity removes a generic entity's core data from Redis.
// It releases the entity's tile lock, removes it from Redis,
// and removes it from the geospatial index.
// It also publishes the 'entity_left' message.
func CleanupEntity(entityID string, entityData map[string]string) {
	log.Printf("Cleaning up entity %s.", entityID)
	pipe := rdb.Pipeline()

	if entityData != nil {
		currentX, _ := strconv.Atoi(entityData["x"])
		currentY, _ := strconv.Atoi(entityData["y"])
		UnlockTileForEntity(entityID, currentX, currentY)
	}

	// Remove the entity's main hash
	pipe.Del(ctx, entityID)
	// Remove the entity from the geospatial index
	pipe.ZRem(ctx, string(RedisKeyZone0Positions), entityID)

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error during entity cleanup for %s: %v", entityID, err)
	}

	// Announce the entity has left
	leftMsg := map[string]interface{}{
		"type":     string(ServerEventEntityLeft),
		"entityId": entityID,
	}
	PublishUpdate(leftMsg)
}
