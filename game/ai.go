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

const LeashDistance = 5

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
		CollisionGrid: BuildCollisionGrid(),
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

	// NEW: Send a stats update to the player if they are online
	if IsPlayerOnline(playerID) {
		statsUpdateMsg := models.PlayerStatsUpdateMessage{
			Type:      string(ServerEventPlayerStatsUpdate),
			Resonance: &newResonance,
		}
		statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
		if sendDirectMessage != nil {
			sendDirectMessage(playerID, statsUpdateJSON)
		}
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

func handleEchoIdling(playerID string, playerData map[string]string, tickCache *TickCache) {
	log.Printf("[Echo AI] %s is idling, deciding on action based on active rune.", playerID)

	activeRune := RuneType(playerData["activeRune"])
	var resourceType TileType

	switch activeRune {
	case RuneTypeChopTrees:
		resourceType = TileTypeTree
	case RuneTypeMineOre:
		resourceType = TileTypeRock
	default: // No active rune, or an unknown rune
		log.Printf("[Echo AI] %s has no active rune. Wandering.", playerID)
		if rand.Intn(100) < 40 {
			dir := getRandomDirection()
			ProcessMove(playerID, dir)
		}
		return
	}
	log.Printf("[Echo AI] %s is using rune: %s", playerID, activeRune)

	currentX, currentY := GetEntityPosition(playerData)
	targetX, targetY, found := findNearestResource(currentX, currentY, resourceType, tickCache)

	if found {
		log.Printf("[Echo AI] %s found nearest %s at %d,%d. Pathfinding...", playerID, resourceType, targetX, targetY)

		// First, check if we're already adjacent.
		if IsAdjacent(currentX, currentY, targetX, targetY) {
			log.Printf("[Echo AI] %s is already adjacent to %d,%d. Gathering...", playerID, targetX, targetY)
			pipe := rdb.Pipeline()
			pipe.HSet(ctx, playerID, "echoState", string(EchoStateGathering))
			pipe.HSet(ctx, playerID, "echoTarget", strconv.Itoa(targetX)+","+strconv.Itoa(targetY))
			pipe.Exec(ctx)
			return // End this tick's logic here.
		}

		// If not adjacent, then find a path.
		path := FindPathToAdjacent(currentX, currentY, targetX, targetY, tickCache)
		if len(path) > 1 {
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
	if len(remainingPath) == 0 {
		// This should not happen if len(path) > 1, but as a safeguard.
		rdb.HSet(ctx, playerID, "echoState", string(EchoStateIdling))
	} else if len(remainingPath) == 1 {
		// We have arrived at the destination (the tile adjacent to the resource)
		rdb.HSet(ctx, playerID, "echoState", string(EchoStateGathering))
	} else {
		// Still more path to traverse
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

	// --- NEW: Check if the resource is depleted ---
	// After gathering, check the tile again. If it's still gatherable,
	// stay in the gathering state. Otherwise, go back to idling.
	_, props, err := GetWorldTile(targetX, targetY)
	if err != nil || !props.IsGatherable {
		// Resource is gone or no longer gatherable, find a new one.
		rdb.HSet(ctx, playerID, "echoState", string(EchoStateIdling))
	}
	// If the resource is still there, the AI will remain in the "gathering"
	// state and this function will be called again on the next AI tick.
}

// findNearestResource finds the nearest resource of a given type to a point.
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
		coordsStr := strings.Split(loc.Name, ":")[1] // "tileType:x,y" -> "x,y"
		if tickCache.LockedTiles[coordsStr] {
			continue // Tile is locked
		}

		// --- BUG FIX: Use the coordinate string from the member name as the source of truth ---
		// The lat/lon from the GEO query can have minor precision errors.
		// The exact game coordinates are stored in the member name.
		coordParts := strings.Split(coordsStr, ",")
		resX, _ := strconv.Atoi(coordParts[0])
		resY, _ := strconv.Atoi(coordParts[1])

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

	// 1. Cooldown Check
	if nextActionAtStr, ok := npcData["nextActionAt"]; ok {
		if nextActionAt, err := strconv.ParseInt(nextActionAtStr, 10, 64); err == nil {
			if time.Now().UnixMilli() < nextActionAt {
				return // On cooldown
			}
		}
	}

	// 2. Gather NPC state
	npcTypeStr, ok := npcData["npcType"]
	if !ok {
		log.Printf("[AI Error] NPC %s has no npcType field. Skipping.", npcID)
		return
	}
	npcType := NPCType(npcTypeStr)
	if npcType == NPCTypeWizard {
		return // Wizards are static and friendly
	}

	npcX, npcY := GetEntityPosition(npcData)
	originX, _ := strconv.Atoi(npcData["originX"])
	originY, _ := strconv.Atoi(npcData["originY"])
	isLeashing, _ := strconv.ParseBool(npcData["isLeashing"])
	groupID, hasGroup := npcData["groupID"]

	// 3. Leash Check & State Trigger
	distToOriginSq := (npcX-originX)*(npcX-originX) + (npcY-originY)*(npcY-originY)
	if !isLeashing && distToOriginSq > LeashDistance*LeashDistance {
		isLeashing = true
		props := NPCDefs[npcType]
		pipe := rdb.Pipeline()
		pipe.HSet(ctx, npcID, "isLeashing", "true")
		pipe.HSet(ctx, npcID, "health", props.Health)
		pipe.Exec(ctx)

		healthUpdateMsg := map[string]interface{}{
			"type":     string(ServerEventEntityUpdate),
			"entityId": npcID,
			"health":   props.Health,
		}
		PublishUpdate(healthUpdateMsg)
	}

	// 4. Determine Action based on State (Leashing > Combat > Idle)
	var finalTargetX, finalTargetY int
	var hasTarget bool
	var targetID string // New: keep track of the target's ID

	// State 1: Leashing takes highest priority
	if isLeashing {
		if npcX == originX && npcY == originY {
			rdb.HSet(ctx, npcID, "isLeashing", "false")
			if hasGroup {
				rdb.Del(ctx, string(GroupTargetPrefix)+groupID)
			}
		} else {
			hasTarget = true
			finalTargetX, finalTargetY = originX, originY
		}
	} else {
		// State 2: Combat
		var targetFound bool
		// Priority 2a: Check for a shared group target
		if hasGroup {
			groupTargetID, err := rdb.Get(ctx, string(GroupTargetPrefix)+groupID).Result()
			if err == nil && groupTargetID != "" {
				targetData, inCache := tickCache.EntityData[groupTargetID]
				if inCache {
					pX, pY := GetEntityPosition(targetData)
					targetID = groupTargetID
					finalTargetX, finalTargetY = pX, pY
					targetFound = true
					hasTarget = true
				} else {
					// Target is not in cache (maybe disconnected/dead), clear group target
					rdb.Del(ctx, string(GroupTargetPrefix)+groupID)
				}
			}
		}

		// Priority 2b: Find a new target if no group target
		if !targetFound {
			foundPlayerID, pX, pY, found := findClosestPlayer(npcID, npcData, tickCache)
			if found {
				targetID = foundPlayerID
				finalTargetX, finalTargetY = pX, pY
				targetFound = true
				hasTarget = true
				// If in a group, "shout" the new target to the group
				if hasGroup {
					rdb.Set(ctx, string(GroupTargetPrefix)+groupID, targetID, 10*time.Second) // Target expires after 10s
				}
			}
		}

		// If a target is set (either from group or new), decide action
		if targetFound {
			if IsAdjacent(npcX, npcY, finalTargetX, finalTargetY) {
				performNPCAttack(npcID, targetID, npcData)
				hasTarget = false // Attack is the action, no need to move
			}
			// if not adjacent, hasTarget is already true, so it will move
		} else {
			// State 3: Idle Behavior (no target, not leashing)
			canWander, _ := strconv.ParseBool(npcData["canWander"])
			if !canWander && (npcX != originX || npcY != originY) {
				// Return to origin
				hasTarget = true
				finalTargetX, finalTargetY = originX, originY
			} else if canWander && rand.Intn(100) < 40 {
				// Wander randomly
				dir := getRandomDirection()
				ProcessMove(npcID, dir)
			}
		}
	}

	// 5. Execute move action if a target was set
	if hasTarget {
		// Pathfind to the final target (could be player, origin, etc.)
		path := FindPath(npcX, npcY, finalTargetX, finalTargetY, tickCache)
		if len(path) > 1 {
			moveAlongPath(npcID, path)
		} else if isLeashing {
			// If leashing and can't find path, set new origin
			pipe := rdb.Pipeline()
			pipe.HSet(ctx, npcID, "originX", npcX)
			pipe.HSet(ctx, npcID, "originY", npcY)
			pipe.HSet(ctx, npcID, "isLeashing", "false")
			pipe.Exec(ctx)
		}
	}

	// 6. Set cooldown
	cooldown, _ := strconv.ParseInt(npcData["moveCooldown"], 10, 64)
	nextActionTime := time.Now().UnixMilli() + cooldown
	rdb.HSet(ctx, npcID, "nextActionAt", nextActionTime)
}

// moveAlongPath moves an NPC one step along a given path.
func moveAlongPath(npcID string, path []*Node) {
	if len(path) < 2 {
		return
	}
	currentX, _ := rdb.HGet(ctx, npcID, "x").Int()
	currentY, _ := rdb.HGet(ctx, npcID, "y").Int()

	nextStep := path[1]
	dx := nextStep.X - currentX
	dy := nextStep.Y - currentY
	var moveDir MoveDirection
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

// findClosestPlayer finds the nearest attackable player within aggro range.
func findClosestPlayer(npcID string, npcData map[string]string, tickCache *TickCache) (string, int, int, bool) {
	npcX, npcY := GetEntityPosition(npcData)
	aggroRange := 5.0
	var targetID string
	var targetX, targetY int
	var targetFound bool
	var closestDistSq float64 = -1

	for entityID, entityData := range tickCache.EntityData {
		if !strings.HasPrefix(entityID, "player:") {
			continue
		}
		if _, ok := entityData["health"]; !ok {
			continue
		}
		pX, pY := GetEntityPosition(entityData)
		targetTile, _, err := GetWorldTile(pX, pY)
		if err == nil && targetTile.IsSanctuary {
			continue
		}

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
	return targetID, targetX, targetY, targetFound
}

// performNPCAttack handles the logic for an NPC attacking a player.
func performNPCAttack(npcID, targetID string, npcData map[string]string) {
	targetX, _ := rdb.HGet(ctx, targetID, "x").Int()
	targetY, _ := rdb.HGet(ctx, targetID, "y").Int()
	UpdateEntityDirection(npcID, targetX, targetY)

	npcType := NPCType(npcData["npcType"])
	props := NPCDefs[npcType]
	damage := props.Damage

	newHealth, err := rdb.HIncrBy(ctx, targetID, "health", int64(-damage)).Result()
	if err != nil {
		log.Printf("Error damaging player %s: %v", targetID, err)
		return
	}

	if props.XPOnDealt > 0 {
		AddExperience(targetID, models.SkillDefense, props.XPOnDealt)
	}

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
		interruptTeleport(targetID)
		h := int(newHealth)
		mh := PlayerDefs.MaxHealth
		statsUpdateMsg := models.PlayerStatsUpdateMessage{
			Type:      string(ServerEventPlayerStatsUpdate),
			Health:    &h,
			MaxHealth: &mh,
		}
		statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
		if sendDirectMessage != nil {
			sendDirectMessage(targetID, statsUpdateJSON)
		}
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
