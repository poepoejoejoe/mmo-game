package game

import (
	"log"
	"math/rand"
	"mmo-game/models"
	"strconv"
	"strings"
	"time"

	"encoding/json"

	"github.com/go-redis/redis/v8"
)

// StartAILoop begins the main game loop for processing NPC actions.
func StartAILoop() {
	log.Println("Starting AI loop...")
	// Run the AI logic on a ticker (e.g., every 750ms)
	ticker := time.NewTicker(750 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		// Run in a goroutine so the ticker isn't blocked
		// if AI processing takes a long time.
		go runAIActions()
	}
}

type EchoState string

const (
	EchoStateIdling    EchoState = "idling"
	EchoStateMoving    EchoState = "moving"
	EchoStateGathering EchoState = "gathering"
)

// runAIActions fetches all entities and processes their next action if they are AI-controlled.
func runAIActions() {
	// Get all entity IDs from the geospatial index
	entityIDs, err := rdb.ZRange(ctx, string(RedisKeyZone0Positions), 0, -1).Result()
	if err != nil {
		log.Printf("Error fetching entities for AI loop: %v", err)
		return
	}

	for _, entityID := range entityIDs {
		// Check the entity type and process accordingly
		if strings.HasPrefix(entityID, "npc:") {
			go processNPCAction(entityID)
		} else if strings.HasPrefix(entityID, "player:") {
			playerData, err := rdb.HGetAll(ctx, entityID).Result()
			if err != nil {
				continue // Skip if we can't get data
			}
			isEcho, _ := strconv.ParseBool(playerData["isEcho"])
			if isEcho {
				go runEchoAI(entityID, playerData)
			}
		}
	}
}

// runEchoAI handles the logic for a player's Echo.
func runEchoAI(playerID string, playerData map[string]string) {
	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return
	}

	// 1. Decrement Resonance
	newResonance, err := rdb.HIncrBy(ctx, playerID, "resonance", -1).Result()
	if err != nil {
		log.Printf("[Echo AI Error] Could not decrement resonance for %s: %v", playerID, err)
		return
	}

	// 2. Check if Resonance has run out
	if newResonance <= 0 {
		log.Printf("Echo for player %s has run out of Resonance.", playerID)
		rdb.HSet(ctx, playerID, "isEcho", "false") // Ensure echo is turned off

		// Check if the player is currently online.
		// A simple way is to see if we have a client connection for them.
		isOnline := sendDirectMessage != nil && IsPlayerOnline(playerID)

		if isOnline {
			// Player is online, so transition them back to active control.
			updateMsg := map[string]interface{}{
				"type":     string(ServerEventEntityUpdate),
				"entityId": playerID,
				"isEcho":   false,
			}
			PublishUpdate(updateMsg)
			log.Printf("Echo for %s expired while online. Control returned.", playerID)
		} else {
			// Player is offline, so despawn the Echo completely.
			rdb.ZRem(ctx, string(RedisKeyZone0Positions), playerID)
			log.Printf("Echo for %s expired while offline. Despawning.", playerID)
		}
		return // Stop further AI processing
	}

	// 3. AI State Machine
	state := EchoState(playerData["echoState"])
	switch state {
	case EchoStateIdling:
		handleEchoIdling(playerID, playerData)
	case EchoStateMoving:
		handleEchoMoving(playerID, playerData)
	case EchoStateGathering:
		handleEchoGathering(playerID, playerData)
	}
}

type EchoAction string

const (
	ActionWander      EchoAction = "wander"
	ActionGatherWood  EchoAction = "gather_wood"
	ActionGatherStone EchoAction = "gather_stone"
)

func selectActionBasedOnXP(playerData map[string]string) EchoAction {
	experienceJSON, ok := playerData["experience"]
	if !ok {
		return ActionWander
	}

	var experience map[models.Skill]float64
	json.Unmarshal([]byte(experienceJSON), &experience)

	// Create a weighted list of actions
	// Give a base weight to wandering
	weightedActions := []struct {
		Action EchoAction
		Weight float64
	}{
		{ActionWander, 10},
	}

	if xp, ok := experience[models.SkillWoodcutting]; ok {
		weightedActions = append(weightedActions, struct {
			Action EchoAction
			Weight float64
		}{ActionGatherWood, xp})
	}
	if xp, ok := experience[models.SkillMining]; ok {
		weightedActions = append(weightedActions, struct {
			Action EchoAction
			Weight float64
		}{ActionGatherStone, xp})
	}

	// Calculate total weight
	var totalWeight float64
	for _, wa := range weightedActions {
		totalWeight += wa.Weight
	}

	// If no skills have XP, just wander
	if totalWeight <= 10 {
		return ActionWander
	}

	// Select a random action based on weight
	r := rand.Float64() * totalWeight
	var cumulativeWeight float64
	for _, wa := range weightedActions {
		cumulativeWeight += wa.Weight
		if r < cumulativeWeight {
			return wa.Action
		}
	}

	return ActionWander // Fallback
}

func handleEchoIdling(playerID string, playerData map[string]string) {
	log.Printf("[Echo AI] %s is idling, deciding on action.", playerID)

	action := selectActionBasedOnXP(playerData)
	log.Printf("[Echo AI] %s chose action: %s", playerID, action)

	var resourceType TileType
	switch action {
	case ActionGatherWood:
		resourceType = TileTypeTree
	case ActionGatherStone:
		resourceType = TileTypeRock
	default: // Wander
		if rand.Intn(100) < 40 {
			dir := getRandomDirection()
			ProcessMove(playerID, dir)
		}
		return
	}

	currentX, currentY := GetEntityPosition(playerData)
	targetX, targetY, found := findNearestResource(currentX, currentY, resourceType)

	if found {
		log.Printf("[Echo AI] %s found nearest %s at %d,%d. Pathfinding...", playerID, resourceType, targetX, targetY)
		path := FindPath(currentX, currentY, targetX, targetY)
		if path != nil && len(path) > 1 {
			pathJSON, _ := json.Marshal(path)
			pipe := rdb.Pipeline()
			pipe.HSet(ctx, playerID, "echoState", string(EchoStateMoving))
			pipe.HSet(ctx, playerID, "echoPath", string(pathJSON))
			pipe.HSet(ctx, playerID, "echoTarget", strconv.Itoa(targetX)+","+strconv.Itoa(targetY))
			pipe.Exec(ctx)
			log.Printf("[Echo AI] %s started moving to %d,%d.", playerID, targetX, targetY)
		} else {
			log.Printf("[Echo AI] %s could not find a path to %d,%d.", playerID, targetX, targetY)
		}
	} else {
		log.Printf("[Echo AI] %s could not find any %s. Wandering.", playerID, resourceType)
		// Wander if no resources are found
		if rand.Intn(100) < 40 {
			dir := getRandomDirection()
			ProcessMove(playerID, dir)
		}
	}
}

func handleEchoMoving(playerID string, playerData map[string]string) {
	var path []*Node
	err := json.Unmarshal([]byte(playerData["echoPath"]), &path)
	if err != nil || len(path) <= 1 {
		rdb.HSet(ctx, playerID, "echoState", string(EchoStateIdling))
		return
	}

	// The first node is the current position, the second is the next step
	nextStep := path[1]
	currentX, currentY := GetEntityPosition(playerData)

	// Determine direction
	var moveDir MoveDirection
	if nextStep.X > currentX {
		moveDir = MoveDirectionRight
	} else if nextStep.X < currentX {
		moveDir = MoveDirectionLeft
	} else if nextStep.Y > currentY {
		moveDir = MoveDirectionDown
	} else {
		moveDir = MoveDirectionUp
	}

	// Perform the move
	ProcessMove(playerID, moveDir)

	// Update the path
	remainingPath := path[1:]
	if len(remainingPath) <= 1 {
		// Reached the destination
		rdb.HSet(ctx, playerID, "echoState", string(EchoStateGathering))
	} else {
		pathJSON, _ := json.Marshal(remainingPath)
		rdb.HSet(ctx, playerID, "echoPath", string(pathJSON))
	}
}

func handleEchoGathering(playerID string, playerData map[string]string) {
	targetCoords := strings.Split(playerData["echoTarget"], ",")
	if len(targetCoords) != 2 {
		rdb.HSet(ctx, playerID, "echoState", string(EchoStateIdling))
		return
	}
	targetX, _ := strconv.Atoi(targetCoords[0])
	targetY, _ := strconv.Atoi(targetCoords[1])

	// Create a fake payload for ProcessInteract
	payload, _ := json.Marshal(models.InteractPayload{X: targetX, Y: targetY})
	ProcessInteract(playerID, payload)

	// Return to idling to find the next thing to do
	rdb.HSet(ctx, playerID, "echoState", string(EchoStateIdling))
}

func findNearestResource(x, y int, tileType TileType) (int, int, bool) {
	// We must use a very large radius because Redis's geo distance calculation
	// interprets our integer tile coordinates as degrees, making tile distances
	// seem huge (1 tile is > 100km).
	// By searching a massive radius and sorting the results, we can efficiently
	// find the closest resource in our coordinate system.
	const searchRadiusKm = 20000 // Guaranteed to cover the entire map.

	locations, err := rdb.GeoRadius(ctx, string(RedisKeyResourcePositions), float64(x), float64(y), &redis.GeoRadiusQuery{
		Radius:    searchRadiusKm,
		Unit:      "km",
		WithCoord: true,
		Sort:      "ASC", // Find the closest first
	}).Result()
	if err != nil {
		log.Printf("[Echo AI] Error finding nearest resource: %v", err)
		return 0, 0, false
	}

	for _, loc := range locations {
		parts := strings.Split(loc.Name, ":")
		if len(parts) == 2 && parts[0] == string(tileType) {
			// Check if the tile is currently locked by someone else
			coords := parts[1]
			lockKey := string(RedisKeyLockTile) + coords
			lockExists, err := rdb.Exists(ctx, lockKey).Result()
			if err != nil {
				continue // Skip on error
			}

			if lockExists == 0 {
				// We found the closest, unlocked resource of the correct type
				xy := strings.Split(coords, ",")
				targetX, _ := strconv.Atoi(xy[0])
				targetY, _ := strconv.Atoi(xy[1])
				return targetX, targetY, true
			}
		}
	}

	// No unlocked resources of this type were found
	return 0, 0, false
}

// processNPCAction contains the core logic for an individual NPC's turn.
func processNPCAction(npcID string) {
	canAct, npcData := CanEntityAct(npcID)
	if !canAct {
		// log.Printf("[AI Debug] NPC %s is on cooldown. Skipping.", npcID)
		return // NPC is on cooldown
	}

	npcTypeStr, ok := npcData["npcType"]
	if !ok {
		log.Printf("[AI Error] NPC %s has no npcType field. Skipping.", npcID)
		return
	}
	npcType := NPCType(npcTypeStr)
	if npcType == NPCTypeWizard {
		return // Wizards are friendly and do not move
	}

	npcX, npcY := GetEntityPosition(npcData)

	// --- REVERTED: Use GeoRadius with explicit coordinates for reliability ---
	locations, err := rdb.GeoRadius(ctx, string(RedisKeyZone0Positions), float64(npcX), float64(npcY), &redis.GeoRadiusQuery{
		Radius:    TilesToKilometers(5), // Use helper for 5-tile aggro range
		Unit:      "km",
		WithCoord: true, // Ask Redis to return coordinates for debugging
	}).Result()
	if err != nil {
		log.Printf("[AI Error] Could not perform GeoRadius for %s: %v", npcID, err)
		return
	}

	var targetID string
	var targetX, targetY int
	var targetFound bool

	// Find the first entity that is a player
	for _, loc := range locations {
		if loc.Name == npcID {
			continue // Skip self
		}

		entityType, err := rdb.HGet(ctx, loc.Name, "entityType").Result()
		if err != nil {
			log.Printf("[AI Error] Could not get entityType for %s: %v. Skipping.", loc.Name, err)
			continue
		}

		if entityType == string(EntityTypePlayer) {
			targetID = loc.Name
			targetData, err := rdb.HGetAll(ctx, targetID).Result()
			if err != nil {
				log.Printf("[AI Error] Could not get target data for %s: %v. Skipping.", targetID, err)
				continue
			}

			// Check if target has health, might be in a weird state
			if _, ok := targetData["health"]; !ok {
				log.Printf("[AI Debug] Target %s has no health field. Skipping.", targetID)
				continue
			}
			targetX, targetY = GetEntityPosition(targetData)
			targetFound = true
			break // First player found is the closest
		}
	}

	// 2. If a player is found, decide whether to attack or move towards them
	if targetFound {
		log.Printf("target found. %s is attacking player %s", npcID, targetID)
		// If adjacent, attack
		if IsAdjacent(npcX, npcY, targetX, targetY) {
			UpdateEntityDirection(npcID, targetX, targetY)
			log.Printf("NPC %s is attacking player %s", npcID, targetID)
			npcTypeStr, ok := npcData["npcType"]
			if !ok {
				log.Printf("[AI Error] NPC %s has no npcType field. Skipping.", npcID)
				return
			}

			npcType := NPCType(npcTypeStr)
			props, ok := NPCDefs[npcType]
			if !ok {
				log.Printf("[AI Error] Unknown NPC type %s for NPC %s. Skipping.", npcType, npcID)
				return
			}
			damage := props.Damage
			newHealth, err := rdb.HIncrBy(ctx, targetID, "health", int64(-damage)).Result()
			if err != nil {
				log.Printf("Error damaging player %s: %v", targetID, err)
				return
			}

			if props.XPOnDealt > 0 {
				AddExperience(targetID, models.SkillDefense, props.XPOnDealt)
			}

			// Broadcast damage message
			damageMsg := models.EntityDamagedMessage{
				Type:     string(ServerEventEntityDamaged),
				EntityID: targetID,
				Damage:   damage,
				X:        targetX,
				Y:        targetY,
			}
			PublishUpdate(damageMsg)

			if newHealth <= 0 {
				HandlePlayerDeath(targetID)
			} else {
				// Also send a stats update to the player who was damaged
				statsUpdateMsg := models.PlayerStatsUpdateMessage{
					Type:      string(ServerEventPlayerStatsUpdate),
					Health:    int(newHealth),
					MaxHealth: PlayerDefs.MaxHealth,
				}
				statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
				if sendDirectMessage != nil {
					sendDirectMessage(targetID, statsUpdateJSON)
				}
			}
		} else {
			// Not adjacent, move towards the player (simple pathfinding)
			dx := targetX - npcX
			dy := targetY - npcY
			var moveDir MoveDirection

			// Move along the axis with the greater distance
			if abs(dx) > abs(dy) {
				if dx > 0 {
					moveDir = MoveDirectionRight
				} else {
					moveDir = MoveDirectionLeft
				}
			} else {
				if dy > 0 {
					moveDir = MoveDirectionDown
				} else {
					moveDir = MoveDirectionUp
				}
			}
			ProcessMove(npcID, moveDir)
		}

		// Set NPC's action cooldown and end turn
		cooldown, _ := strconv.ParseInt(npcData["moveCooldown"], 10, 64)
		nextActionTime := time.Now().UnixMilli() + cooldown
		rdb.HSet(ctx, npcID, "nextActionAt", nextActionTime)
		return
	}

	// 3. If no player is found, wander randomly
	if rand.Intn(100) < 40 {
		dir := getRandomDirection()
		ProcessMove(npcID, dir)
	}
}

// getRandomDirection selects a random cardinal direction.
func getRandomDirection() MoveDirection {
	directions := []MoveDirection{
		MoveDirectionUp,
		MoveDirectionDown,
		MoveDirectionLeft,
		MoveDirectionRight,
	}
	return directions[rand.Intn(len(directions))]
}

// abs is a simple helper function to get the absolute value of an integer.
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
