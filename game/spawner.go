package game

import (
	"log"
	"math/rand"
	"strings"
	"time"
)

const (
	targetSlimeCount     = 5
	targetRatCount       = 7
	spawnerCheckInterval = 30 * time.Second
)

// StartSpawnerLoop begins the loop for checking and spawning NPCs.
func StartSpawnerLoop() {
	log.Println("Starting NPC spawner loop...")
	ticker := time.NewTicker(spawnerCheckInterval)
	defer ticker.Stop()

	for {
		<-ticker.C
		go checkAndSpawnNPCs()
	}
}

func checkAndSpawnNPCs() {
	entityIDs, err := rdb.ZRange(ctx, string(RedisKeyZone0Positions), 0, -1).Result()
	if err != nil {
		log.Printf("Error fetching entities for spawner: %v", err)
		return
	}

	currentSlimeCount := 0
	currentRatCount := 0
	for _, entityID := range entityIDs {
		if strings.HasPrefix(entityID, string(NPCSlimePrefix)) {
			currentSlimeCount++
		} else if strings.HasPrefix(entityID, string(NPCRatPrefix)) {
			currentRatCount++
		}
	}

	log.Printf("Spawner check: Slimes=%d/%d, Rats=%d/%d", currentSlimeCount, targetSlimeCount, currentRatCount, targetRatCount)

	// Spawn missing slimes
	for i := currentSlimeCount; i < targetSlimeCount; i++ {
		go func() {
			// Stagger the spawns to make them feel more natural
			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
			spawnSlime()
		}()
	}

	// Spawn missing rats
	for i := currentRatCount; i < targetRatCount; i++ {
		go func() {
			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
			spawnRat()
		}()
	}
}
