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

// SpawnNPC creates a new NPC of a given type at a specific location.
func SpawnNPC(entityID string, x, y int, npcType NPCType) {
	// Lock the tile for the NPC before creating it
	locked, err := LockTileForEntity(entityID, x, y)
	if err != nil || !locked {
		log.Printf("Failed to lock spawn tile for NPC %s at %d,%d. Aborting spawn.", entityID, x, y)
		return
	}

	props := NPCDefs[npcType]

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, entityID,
		"x", x,
		"y", y,
		"entityType", string(EntityTypeNPC),
		"npcType", string(npcType),
		"health", props.Health,
		"nextActionAt", time.Now().UnixMilli(),
		"moveCooldown", 750,
	)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      entityID,
		Longitude: float64(x),
		Latitude:  float64(y),
	})

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to spawn %s %s: %v", npcType, entityID, err)
		// If spawning fails, unlock the tile
		UnlockTileForEntity(entityID, x, y)
		return
	}

	joinMsg := map[string]interface{}{
		"type":       string(ServerEventEntityJoined),
		"entityId":   entityID,
		"x":          x,
		"y":          y,
		"entityType": string(EntityTypeNPC),
		"name":       string(npcType),
	}
	PublishUpdate(joinMsg)
}

// spawnSlime creates a new slime entity in the world.
func spawnSlime() {
	entityID := string(NPCSlimePrefix) + utils.GenerateUniqueID()
	spawnX, spawnY := FindOpenSpawnPoint(entityID)
	SpawnNPC(entityID, spawnX, spawnY, NPCTypeSlime)
}

// spawnRat creates a new rat entity in the world.
func spawnRat() {
	entityID := string(NPCRatPrefix) + utils.GenerateUniqueID()
	spawnX, spawnY := FindOpenSpawnPoint(entityID)
	SpawnNPC(entityID, spawnX, spawnY, NPCTypeRat)
}

func spawnWizard() {
	entityID := string(NPCWizardPrefix) + utils.GenerateUniqueID()
	SpawnNPC(entityID, 2, 0, NPCTypeWizard)
}
