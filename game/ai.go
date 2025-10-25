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
		go runNPCActions()
	}
}

// runNPCActions fetches all NPCs and processes their next action.
func runNPCActions() {
	// Get all entity IDs from the geospatial index
	entityIDs, err := rdb.ZRange(ctx, string(RedisKeyZone0Positions), 0, -1).Result()
	if err != nil {
		log.Printf("Error fetching entities for AI loop: %v", err)
		return
	}

	for _, entityID := range entityIDs {
		// Check if the entity is an NPC
		if strings.HasPrefix(entityID, "npc:") {
			go processNPCAction(entityID)
		}
	}
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
