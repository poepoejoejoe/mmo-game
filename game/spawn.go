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
func findRandomOpenTile(occupied map[string]bool) (int, int) {
	for i := 0; i < 100; i++ { // Try 100 times to find a valid spot
		x := rand.Intn(WorldSize*2) - WorldSize
		y := rand.Intn(WorldSize*2) - WorldSize
		coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
		if isTileAvailable(x, y) && !occupied[coordKey] {
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

func spawnPreLockedNPC(entityID string, x, y int, npcType NPCType, groupID string, originX, originY int, wanderDistance int) {
	props := NPCDefs[npcType]

	pipe := rdb.Pipeline()
	hsetArgs := []interface{}{
		"x", x,
		"y", y,
		"originX", originX,
		"originY", originY,
		"isLeashing", "false",
		"wanderDistance", wanderDistance,
		"entityType", string(EntityTypeNPC),
		"npcType", string(npcType),
		"health", props.MaxHealth,
		"nextActionAt", time.Now().UnixMilli(),
		"moveCooldown", 750,
	}
	if groupID != "" {
		hsetArgs = append(hsetArgs, "groupID", groupID)
	}
	log.Printf("[Debug] HSET for %s: %v", entityID, hsetArgs)
	pipe.HSet(ctx, entityID, hsetArgs...)

	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      entityID,
		Longitude: float64(x),
		Latitude:  float64(y),
	})

	_, err := pipe.Exec(ctx)
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

func spawnNPC(entityID string, x, y int, npcType NPCType, groupID string, originX, originY int, wanderDistance int) {
	// Lock the tile for the NPC before creating it
	locked, err := LockTileForEntity(entityID, x, y)
	if err != nil || !locked {
		log.Printf("Failed to lock spawn tile for NPC %s at %d,%d. Aborting spawn.", entityID, x, y)
		return
	}
	spawnPreLockedNPC(entityID, x, y, npcType, groupID, originX, originY, wanderDistance)
}

// spawnSlime creates a new slime entity in the world.
func spawnSlime() {
	entityID := string(NPCSlimePrefix) + utils.GenerateUniqueID()
	spawnX, spawnY := findRandomOpenTile(nil)
	spawnNPC(entityID, spawnX, spawnY, NPCTypeSlime, "", spawnX, spawnY, NPCDefs[NPCTypeSlime].WanderDistance)
}

func findGroupSpawn(numMembers int, formation [][2]int) ([][2]int, bool) {
	for i := 0; i < 100; i++ {
		centerX, centerY := findRandomOpenTile(nil)

		// Check distance from all sanctuaries
		tooClose := false
		for _, s := range Sanctuaries {
			dx := centerX - s.X
			dy := centerY - s.Y
			// Using Chebyshev distance (max of absolute differences)
			if dx < 0 {
				dx = -dx
			}
			if dy < 0 {
				dy = -dy
			}
			var dist int
			if dx > dy {
				dist = dx
			} else {
				dist = dy
			}

			if dist < 8 {
				tooClose = true
				break
			}
		}
		if tooClose {
			continue // Try a new spot
		}

		// Check 3x3 grid around the center
		allValid := true
		for dx := -1; dx <= 1; dx++ {
			for dy := -1; dy <= 1; dy++ {
				checkX, checkY := centerX+dx, centerY+dy
				tile, _, err := GetWorldTile(checkX, checkY)
				if err != nil || !isTileAvailable(checkX, checkY) || (tile != nil && tile.IsSanctuary) {
					allValid = false
					break
				}
			}
			if !allValid {
				break
			}
		}

		if allValid {
			// All checks passed, calculate final positions
			positions := [][2]int{{centerX, centerY}}
			for _, offset := range formation {
				positions = append(positions, [2]int{centerX + offset[0], centerY + offset[1]})
			}
			return positions, true
		}
	}
	return nil, false
}

// spawnSlimeBoss creates a new slime boss entity in the world.
func spawnSlimeBoss() {
	formation := [][2]int{
		{-1, -1}, {1, -1}, // Top-left, Top-right
		{-1, 1}, {1, 1}, // Bottom-left, Bottom-right
	}

	positions, found := findGroupSpawn(5, formation)
	if !found {
		log.Println("Could not find a valid spawn location for slime boss group after 100 attempts.")
		return
	}

	bossPosition := positions[0]
	bossX, bossY := bossPosition[0], bossPosition[1]

	bossID := string(NPCBossSlimePrefix) + utils.GenerateUniqueID()
	slimeIDs := make([]string, 4)
	for i := 0; i < 4; i++ {
		slimeIDs[i] = string(NPCSlimePrefix) + utils.GenerateUniqueID()
	}

	entityIDs := append([]string{bossID}, slimeIDs...)
	var lockedTiles [][2]int
	allLocked := true

	for i, pos := range positions {
		entityID := entityIDs[i]
		locked, err := LockTileForEntity(entityID, pos[0], pos[1])
		if err != nil || !locked {
			allLocked = false
			break
		}
		lockedTiles = append(lockedTiles, pos)
	}

	if allLocked {
		groupID := "slimegroup:" + utils.GenerateUniqueID()
		spawnPreLockedNPC(bossID, bossX, bossY, NPCTypeSlimeBoss, groupID, bossX, bossY, NPCDefs[NPCTypeSlimeBoss].WanderDistance)

		for i, slimeID := range slimeIDs {
			minionPos := positions[i+1]
			spawnPreLockedNPC(slimeID, minionPos[0], minionPos[1], NPCTypeSlime, groupID, minionPos[0], minionPos[1], 1)
		}
	} else {
		for i, pos := range lockedTiles {
			UnlockTileForEntity(entityIDs[i], pos[0], pos[1])
		}
	}
}

// spawnRat creates a new rat entity in the world.
func spawnRat() {
	entityID := string(NPCRatPrefix) + utils.GenerateUniqueID()
	spawnX, spawnY := findRandomOpenTile(nil)
	spawnNPC(entityID, spawnX, spawnY, NPCTypeRat, "", spawnX, spawnY, NPCDefs[NPCTypeRat].WanderDistance)
}

func spawnWizard() {
	entityID := string(NPCWizardPrefix) + utils.GenerateUniqueID()
	spawnNPC(entityID, 4, 0, NPCTypeWizard, "", 4, 0, NPCDefs[NPCTypeWizard].WanderDistance)
}
