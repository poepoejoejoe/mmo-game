package game

import (
	"log"
	"mmo-game/game/utils"
	"time"

	"math/rand"
	"strconv"

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
func SpawnNPC(entityID string, x, y int, npcType NPCType, canWander bool, groupID string) {
	// Lock the tile for the NPC before creating it
	locked, err := LockTileForEntity(entityID, x, y)
	if err != nil || !locked {
		log.Printf("Failed to lock spawn tile for NPC %s at %d,%d. Aborting spawn.", entityID, x, y)
		return
	}

	props := NPCDefs[npcType]

	pipe := rdb.Pipeline()
	hsetArgs := []interface{}{
		"x", x,
		"y", y,
		"originX", x,
		"originY", y,
		"isLeashing", "false",
		"canWander", strconv.FormatBool(canWander),
		"entityType", string(EntityTypeNPC),
		"npcType", string(npcType),
		"health", props.MaxHealth,
		"nextActionAt", time.Now().UnixMilli(),
		"moveCooldown", 750,
	}
	if groupID != "" {
		hsetArgs = append(hsetArgs, "groupID", groupID)
	}
	pipe.HSet(ctx, entityID, hsetArgs...)

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
	for i := 0; i < 100; i++ { // Try 100 times to find a valid spot
		spawnX, spawnY := FindOpenSpawnPoint(entityID)
		tile, _, err := GetWorldTile(spawnX, spawnY)
		if err == nil && !tile.IsSanctuary {
			SpawnNPC(entityID, spawnX, spawnY, NPCTypeSlime, true, "")
			return
		}
		// Unlock the invalid tile if it was locked
		UnlockTileForEntity(entityID, spawnX, spawnY)
	}
}

// spawnSlimeBoss creates a new slime boss entity in the world.
func spawnSlimeBoss() {
	for i := 0; i < 100; i++ { // Try 100 times to find a valid spot
		bossX, bossY := findRandomSpawnPoint()

		// Define the relative positions for the 4 slimes in a dice-5 pattern
		slimePositions := [][2]int{
			{-1, -1}, {1, -1},
			{-1, 1}, {1, 1},
		}

		// Check if the boss's tile and all slime tiles are valid
		allValid := true
		positionsToSpawn := [][2]int{{bossX, bossY}} // Include boss's position

		for _, pos := range slimePositions {
			x, y := bossX+pos[0], bossY+pos[1]
			if !isSpawnPointValid(x, y) {
				allValid = false
				break
			}
			positionsToSpawn = append(positionsToSpawn, [2]int{x, y})
		}

		if allValid {
			// Spawn the boss
			bossID := string(NPCBossSlimePrefix) + utils.GenerateUniqueID()
			groupID := "slimegroup:" + utils.GenerateUniqueID()
			SpawnNPC(bossID, bossX, bossY, NPCTypeSlimeBoss, false, groupID)

			// Spawn the 4 slimes
			for _, pos := range slimePositions {
				slimeID := string(NPCSlimePrefix) + utils.GenerateUniqueID()
				SpawnNPC(slimeID, bossX+pos[0], bossY+pos[1], NPCTypeSlime, false, groupID)
			}
			return // Exit after successful spawn
		}
	}
}

// isSpawnPointValid checks if a given coordinate is a valid place for an NPC to spawn.
func isSpawnPointValid(x, y int) bool {
	// Check world boundaries, collidability, and sanctuary status
	tile, props, err := GetWorldTile(x, y)
	if err != nil {
		return false // Can't get tile info, assume invalid
	}
	if props.IsCollidable || tile.IsSanctuary {
		return false
	}
	// Check if the tile is locked by another entity
	if IsTileLocked(x, y) {
		return false
	}
	return true
}

// findRandomSpawnPoint finds a random, unlocked, and walkable tile.
func findRandomSpawnPoint() (int, int) {
	// This is a simplified version. A real implementation might need to
	// be more robust to avoid infinite loops if the map is full.
	for {
		x := rand.Intn(WorldSize*2) - WorldSize
		y := rand.Intn(WorldSize*2) - WorldSize
		if isSpawnPointValid(x, y) {
			return x, y
		}
	}
}

// spawnRat creates a new rat entity in the world.
func spawnRat() {
	entityID := string(NPCRatPrefix) + utils.GenerateUniqueID()
	for i := 0; i < 100; i++ { // Try 100 times to find a valid spot
		spawnX, spawnY := FindOpenSpawnPoint(entityID)
		tile, _, err := GetWorldTile(spawnX, spawnY)
		if err == nil && !tile.IsSanctuary {
			SpawnNPC(entityID, spawnX, spawnY, NPCTypeRat, true, "")
			return
		}
		// Unlock the invalid tile if it was locked
		UnlockTileForEntity(entityID, spawnX, spawnY)
	}
}

func spawnWizard() {
	entityID := string(NPCWizardPrefix) + utils.GenerateUniqueID()
	SpawnNPC(entityID, 4, 0, NPCTypeWizard, false, "")
}
