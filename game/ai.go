package game

import (
	"log"
	"math/rand"
	"strings"
	"time"
)

// StartAILoop begins the main game loop for processing NPC actions.
func StartAILoop() {
	log.Println("Starting AI loop...")
	// Run the AI logic on a ticker (e.g., every 2 seconds)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Run in a goroutine so the ticker isn't blocked
		// if AI processing takes a long time.
		go runNPCActions()
	}
}

// runNPCActions fetches all NPCs and processes their next action.
func runNPCActions() {
	// Get all entities currently in the world
	// Note: For a larger game, we'd scan by entityType,
	// but this is fine for now.
	entityIDs, err := rdb.ZRange(ctx, string(RedisKeyZone0Positions), 0, -1).Result()
	if err != nil {
		log.Printf("Error fetching entities for AI loop: %v", err)
		return
	}

	for _, entityID := range entityIDs {
		// We only care about slime NPCs
		if strings.HasPrefix(entityID, string(NPCSlimePrefix)) {
			processSlimeAI(entityID)
		} else if strings.HasPrefix(entityID, string(NPCRatPrefix)) {
			processRatAI(entityID)
		}
	}
}

// processSlimeAI defines the simple AI for a single slime.
func processSlimeAI(slimeID string) {
	// Check if the slime can act
	canAct, _ := CanEntityAct(slimeID)
	if !canAct {
		return // Slime is on cooldown, do nothing
	}

	// Slime AI: 30% chance to move in a random direction
	if rand.Intn(100) < 30 {
		dir := getRandomDirection()
		// Use the generic ProcessMove function.
		// It will handle cooldowns and collisions automatically.
		ProcessMove(slimeID, dir)
	}
}

// getRandomDirection selects a random cardinal direction.
func getRandomDirection() string {
	directions := []string{
		string(MoveDirectionUp),
		string(MoveDirectionDown),
		string(MoveDirectionLeft),
		string(MoveDirectionRight),
	}
	return directions[rand.Intn(len(directions))]
}

// processRatAI defines the simple AI for a single rat.
func processRatAI(ratID string) {
	// Check if the rat can act
	canAct, _ := CanEntityAct(ratID)
	if !canAct {
		return // Rat is on cooldown, do nothing
	}

	// Rat AI: 50% chance to move in a random direction
	if rand.Intn(100) < 50 {
		dir := getRandomDirection()
		// Use the generic ProcessMove function.
		// It will handle cooldowns and collisions automatically.
		ProcessMove(ratID, dir)
	}
}
