package game

import (
	"log"
	"math/rand"
	"mmo-game/game/utils"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

// findRandomOpenTile attempts to find a random, un-collidable, and unlocked tile.
func findRandomOpenTile() (int, int) {
	for i := 0; i < 100; i++ { // Try 100 times to find a valid spot
		x := rand.Intn(WorldSize*2) - WorldSize
		y := rand.Intn(WorldSize*2) - WorldSize
		if isTileAvailable(x, y) {
			tile, _, err := GetWorldTile(x, y)
			if err == nil && !tile.IsSanctuary {
				return x, y
			}
		}
	}
	// Fallback, though unlikely to be hit in a large world
	return 0, 0
}

// findNearbyOpenTile finds an open tile within a certain radius of a given point.
func findNearbyOpenTile(x, y, radius int) (int, int) {
	for r := 1; r <= radius; r++ {
		var availablePoints [][2]int
		for i := -r; i <= r; i++ {
			for j := -r; j <= r; j++ {
				// Only check the perimeter of the square for this radius
				if i != r && i != -r && j != r && j != -r {
					continue
				}
				checkX, checkY := x+i, y+j
				if isTileAvailable(checkX, checkY) {
					availablePoints = append(availablePoints, [2]int{checkX, checkY})
				}
			}
		}

		if len(availablePoints) > 0 {
			// Pick a random point from the available ones
			randomIndex := rand.Intn(len(availablePoints))
			point := availablePoints[randomIndex]
			return point[0], point[1]
		}
	}
	// Fallback to the center of the search area if no open tile is found
	return x, y
}

func SpawnPlayer(playerID string, playerData map[string]string) (int, int) {
	binding, ok := playerData["binding"]
	if ok && binding != "" {
		parts := strings.Split(binding, ",")
		if len(parts) == 2 {
			x, errX := strconv.Atoi(parts[0])
			y, errY := strconv.Atoi(parts[1])
			if errX == nil && errY == nil {
				return findNearbyOpenTile(x, y, 5)
			}
		}
	}

	// Fallback to a random sanctuary
	randomSanctuary := Sanctuaries[rand.Intn(len(Sanctuaries))]
	return findNearbyOpenTile(randomSanctuary.X, randomSanctuary.Y, randomSanctuary.Radius)
}

func spawnNPC(entityID string, x, y int, npcType NPCType, canWander bool, groupID string) {
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
	spawnX, spawnY := findRandomOpenTile()
	spawnNPC(entityID, spawnX, spawnY, NPCTypeSlime, true, "")
}

// spawnSlimeBoss creates a new slime boss entity in the world.
func spawnSlimeBoss() {
	for i := 0; i < 100; i++ { // Try 100 times to find a valid spot
		bossX, bossY := findRandomOpenTile()

		// Define the relative positions for the 4 slimes in a dice-5 pattern
		slimePositions := [][2]int{
			{-1, -1}, {1, -1},
			{-1, 1}, {1, 1},
		}

		// Check if the boss's tile and all slime tiles are valid
		allValid := true
		for _, pos := range slimePositions {
			x, y := bossX+pos[0], bossY+pos[1]
			if !isTileAvailable(x, y) {
				allValid = false
				break
			}
		}

		if allValid {
			// Spawn the boss
			bossID := string(NPCBossSlimePrefix) + utils.GenerateUniqueID()
			groupID := "slimegroup:" + utils.GenerateUniqueID()
			spawnNPC(bossID, bossX, bossY, NPCTypeSlimeBoss, false, groupID)

			// Spawn the 4 slimes
			for _, pos := range slimePositions {
				slimeID := string(NPCSlimePrefix) + utils.GenerateUniqueID()
				spawnNPC(slimeID, bossX+pos[0], bossY+pos[1], NPCTypeSlime, false, groupID)
			}
			return // Exit after successful spawn
		}
	}
}

// spawnRat creates a new rat entity in the world.
func spawnRat() {
	entityID := string(NPCRatPrefix) + utils.GenerateUniqueID()
	spawnX, spawnY := findRandomOpenTile()
	spawnNPC(entityID, spawnX, spawnY, NPCTypeRat, true, "")
}

func spawnWizard() {
	entityID := string(NPCWizardPrefix) + utils.GenerateUniqueID()
	spawnNPC(entityID, 4, 0, NPCTypeWizard, false, "")
}
