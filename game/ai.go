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
	tickCache, err := buildTickCache()
	if err != nil {
		log.Printf("Error building tick cache for AI loop: %v", err)
		return
	}

	for entityID, entityData := range tickCache.EntityData {
		// Stagger AI ticks to smooth out server load.
		time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)

		// Check the entity type and process accordingly
		if strings.HasPrefix(entityID, "npc:") {
			go processNPCAction(entityID, tickCache)
		} else if strings.HasPrefix(entityID, "player:") {
			isEcho, _ := strconv.ParseBool(entityData["isEcho"])
			if isEcho {
				go runEchoAI(entityID, tickCache)
			}
		}
	}
}

func buildTickCache() (*TickCache, error) {
	cache := &TickCache{
		EntityData:    make(map[string]map[string]string),
		ResourceNodes: make(map[TileType][]redis.GeoLocation),
		LockedTiles:   make(map[string]bool),
	}

	// 1. Get all entity IDs
	entityIDs, err := rdb.ZRange(ctx, string(RedisKeyZone0Positions), 0, -1).Result()
	if err != nil {
		return nil, err
	}

	pipe := rdb.Pipeline()

	// 2. Queue HGETALL for each entity
	entityDataCmds := make(map[string]*redis.StringStringMapCmd)
	for _, entityID := range entityIDs {
		entityDataCmds[entityID] = pipe.HGetAll(ctx, entityID)
	}

	// 3. Queue GEORADIUS for all resource types
	// We search from the center of the map with a radius large enough to cover everything.
	const searchRadiusKm = 20000
	resourceCmds := make(map[TileType]*redis.GeoLocationCmd)
	for tileType, props := range TileDefs {
		if props.IsGatherable {
			query := &redis.GeoRadiusQuery{
				Radius:    searchRadiusKm,
				Unit:      "km",
				WithCoord: true,
				Sort:      "ASC",
			}
			resourceCmds[tileType] = pipe.GeoRadius(ctx, string(RedisKeyResourcePositions), 0, 0, query)
		}
	}

	// 4. Queue SCAN for all locked tiles
	lockedTileKeys, err := rdb.Keys(ctx, string(RedisKeyLockTile)+"*").Result()
	if err != nil {
		log.Printf("Could not get locked tiles using KEYS, falling back to empty set: %v", err)
	}

	// Execute all queued commands
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, err
	}

	// --- Process Results ---

	// Process entity data
	for entityID, cmd := range entityDataCmds {
		data, err := cmd.Result()
		if err == nil {
			cache.EntityData[entityID] = data
		}
	}

	// Process resource locations
	for tileType, cmd := range resourceCmds {
		locations, err := cmd.Result()
		if err == nil {
			// Filter for the correct resource type since GeoRadius on "positions:resource"
			// returns all resources. The member name is "tileType:x,y".
			var filteredLocations []redis.GeoLocation
			for _, loc := range locations {
				if strings.HasPrefix(loc.Name, string(tileType)+":") {
					filteredLocations = append(filteredLocations, loc)
				}
			}
			cache.ResourceNodes[tileType] = filteredLocations
		}
	}

	// Process locked tiles
	for _, key := range lockedTileKeys {
		// key is "lock:tile:x,y", we want to store "x,y"
		coords := strings.TrimPrefix(key, string(RedisKeyLockTile))
		cache.LockedTiles[coords] = true
	}

	return cache, nil
}

// runEchoAI handles the logic for a player's Echo.
func runEchoAI(playerID string, tickCache *TickCache) {
	playerData := tickCache.EntityData[playerID]
	if nextActionAtStr, ok := playerData["nextActionAt"]; ok {
		if nextActionAt, err := strconv.ParseInt(nextActionAtStr, 10, 64); err == nil {
			if time.Now().UnixMilli() < nextActionAt {
				return // On cooldown
			}
		}
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
		handleEchoIdling(playerID, playerData, tickCache)
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

func handleEchoIdling(playerID string, playerData map[string]string, tickCache *TickCache) {
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
	targetX, targetY, found := findNearestResource(currentX, currentY, resourceType, tickCache)

	if found {
		log.Printf("[Echo AI] %s found nearest %s at %d,%d. Pathfinding...", playerID, resourceType, targetX, targetY)
		path := FindPath(currentX, currentY, targetX, targetY, tickCache)
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

func findNearestResource(x, y int, tileType TileType, tickCache *TickCache) (int, int, bool) {
	locations, ok := tickCache.ResourceNodes[tileType]
	if !ok {
		return 0, 0, false
	}

	// The locations are pre-sorted by distance from the center of the map,
	// which is not useful here. We need to find the closest to the entity's position.
	var closestDistSq float64 = -1
	var targetX, targetY int
	found := false

	for _, loc := range locations {
		coords := strings.Split(loc.Name, ":")[1] // "tileType:x,y" -> "x,y"
		if tickCache.LockedTiles[coords] {
			continue // Tile is locked
		}

		resX := int(loc.Longitude)
		resY := int(loc.Latitude)
		dx := float64(x - resX)
		dy := float64(y - resY)
		distSq := dx*dx + dy*dy

		if !found || distSq < closestDistSq {
			closestDistSq = distSq
			targetX = resX
			targetY = resY
			found = true
		}
	}

	if found {
		return targetX, targetY, true
	}

	return 0, 0, false
}

// processNPCAction contains the core logic for an individual NPC's turn.
func processNPCAction(npcID string, tickCache *TickCache) {
	npcData := tickCache.EntityData[npcID]
	if nextActionAtStr, ok := npcData["nextActionAt"]; ok {
		if nextActionAt, err := strconv.ParseInt(nextActionAtStr, 10, 64); err == nil {
			if time.Now().UnixMilli() < nextActionAt {
				return // On cooldown
			}
		}
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
	aggroRange := 5.0

	var targetID string
	var targetX, targetY int
	var targetFound bool
	var closestDistSq float64 = -1

	// Find the closest player in range from the cache
	for entityID, entityData := range tickCache.EntityData {
		if !strings.HasPrefix(entityID, "player:") {
			continue // Not a player
		}

		// Check if target has health, might be in a weird state
		if _, ok := entityData["health"]; !ok {
			continue
		}

		pX, pY := GetEntityPosition(entityData)
		dx := float64(npcX - pX)
		dy := float64(npcY - pY)
		distSq := dx*dx + dy*dy

		if distSq <= aggroRange*aggroRange {
			if !targetFound || distSq < closestDistSq {
				targetFound = true
				closestDistSq = distSq
				targetID = entityID
				targetX = pX
				targetY = pY
			}
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
