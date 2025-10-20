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
	spawnRat(1) // Spawn one rat
}

// spawnSlime creates a new slime entity in the world.
func spawnSlime(id int) {
	entityID := string(NPCSlimePrefix) + strconv.Itoa(id)
	npcType := NPCTypeSlime

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

	_, err = pipe.Exec(ctx)
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
func spawnRat(id int) {
	entityID := string(NPCRatPrefix) + strconv.Itoa(id)
	npcType := NPCTypeRat

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

	_, err = pipe.Exec(ctx)
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
