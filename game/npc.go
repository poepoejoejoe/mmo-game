package game

import (
	"log"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// InitializeNPCs spawns the initial set of NPCs for the world.
func InitializeNPCs() {
	log.Println("Spawning NPCs...")
	// For now, just spawn one slime
	spawnSlime(1)
}

// spawnSlime creates a new slime entity in the world.
func spawnSlime(id int) {
	entityID := string(NPCSlimePrefix) + strconv.Itoa(id)

	// Check if this NPC already exists
	exists, err := rdb.Exists(ctx, entityID).Result()
	if err != nil {
		log.Printf("Error checking existence of NPC %s: %v", entityID, err)
		return
	}
	if exists > 0 {
		log.Printf("NPC %s already exists. Skipping spawn.", entityID)
		return
	}

	spawnX, spawnY := FindOpenSpawnPoint(entityID)

	pipe := rdb.Pipeline()
	// Set the NPC's core data
	pipe.HSet(ctx, entityID,
		"x", spawnX,
		"y", spawnY,
		"entityType", string(EntityTypeNPC), // Internal type
		"npcType", "slime", // Specific type
		"health", 3,
		"nextActionAt", time.Now().UnixMilli(),
	)
	// Add it to the geospatial index
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      entityID,
		Longitude: float64(spawnX),
		Latitude:  float64(spawnY),
	})

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to spawn slime %s: %v", entityID, err)
		return
	}

	log.Printf("Spawned slime %s at (%d, %d)", entityID, spawnX, spawnY)

	// Announce the new entity's arrival
	joinMsg := map[string]interface{}{
		"entityId": entityID,
		"x":        spawnX,
		"y":        spawnY,
		"type":     "slime", // <-- NEW: Send the specific type
	}
	PublishUpdate(joinMsg)
}
