package game

import (
	"log"
	"mmo-game/game/utils"
	"time"

	"github.com/go-redis/redis/v8"
)

// InitializeNPCs spawns the initial set of NPCs for the world.
func InitializeNPCs() {
	// This is now handled by the spawner loop.
	// We can leave this function empty or remove it.
	// For now, let's just log that we're skipping it.
	log.Println("Initial NPC spawning is now handled by the spawner loop.")
}

// spawnSlime creates a new slime entity in the world.
func spawnSlime() {
	entityID := string(NPCSlimePrefix) + utils.GenerateUniqueID()
	npcType := NPCTypeSlime

	// No need to check for existence with unique IDs

	spawnX, spawnY := FindOpenSpawnPoint(entityID)
	props := NPCDefs[npcType]

	pipe := rdb.Pipeline()
	// Set the NPC's core data
	pipe.HSet(ctx, entityID,
		"x", spawnX,
		"y", spawnY,
		"entityType", string(EntityTypeNPC), // Internal type
		"npcType", string(npcType), // Specific type
		"health", props.Health,
		"nextActionAt", time.Now().UnixMilli(),
		"moveCooldown", 750, // 750ms move cooldown
	)
	// Add it to the geospatial index
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      entityID,
		Longitude: float64(spawnX),
		Latitude:  float64(spawnY),
	})

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to spawn slime %s: %v", entityID, err)
		return
	}

	log.Printf("Spawned slime %s at (%d, %d)", entityID, spawnX, spawnY)

	// Announce the new entity's arrival
	joinMsg := map[string]interface{}{
		"type":       string(ServerEventEntityJoined),
		"entityId":   entityID,
		"x":          spawnX,
		"y":          spawnY,
		"entityType": string(npcType), // <-- NEW: Send the specific type
	}
	PublishUpdate(joinMsg)
}

// spawnRat creates a new rat entity in the world.
func spawnRat() {
	entityID := string(NPCRatPrefix) + utils.GenerateUniqueID()
	npcType := NPCTypeRat

	// No need to check for existence with unique IDs

	spawnX, spawnY := FindOpenSpawnPoint(entityID)
	props := NPCDefs[npcType]

	pipe := rdb.Pipeline()
	// Set the NPC's core data
	pipe.HSet(ctx, entityID,
		"x", spawnX,
		"y", spawnY,
		"entityType", string(EntityTypeNPC), // Internal type
		"npcType", string(npcType), // Specific type
		"health", props.Health,
		"nextActionAt", time.Now().UnixMilli(),
		"moveCooldown", 750, // 750ms move cooldown
	)
	// Add it to the geospatial index
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      entityID,
		Longitude: float64(spawnX),
		Latitude:  float64(spawnY),
	})

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to spawn rat %s: %v", entityID, err)
		return
	}

	log.Printf("Spawned rat %s at (%d, %d)", entityID, spawnX, spawnY)

	// Announce the new entity's arrival
	joinMsg := map[string]interface{}{
		"type":       string(ServerEventEntityJoined),
		"entityId":   entityID,
		"x":          spawnX,
		"y":          spawnY,
		"entityType": string(npcType), // <-- NEW: Send the specific type
	}
	PublishUpdate(joinMsg)
}
