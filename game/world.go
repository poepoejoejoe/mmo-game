package game

import (
	"log"
	"math/rand"
	"strconv"
)

// GenerateWorld creates the terrain and resource health data in Redis if it
// doesn't already exist. This makes the world persistent.
func GenerateWorld() {
	log.Println("Generating world terrain...")
	worldKey := "world:zone:0"
	healthKey := "world:health:zone:0"

	// Check if the world has already been generated to prevent overwriting it.
	if rdb.Exists(ctx, worldKey).Val() > 0 {
		log.Println("World already exists in Redis. Skipping generation.")
		return
	}

	// Use pipelines to batch Redis commands for much faster world generation.
	worldPipe := rdb.Pipeline()
	healthPipe := rdb.Pipeline()

	// Iterate through every tile in the defined WorldSize grid.
	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
			noise := rand.Float64() // Generate a random number for this tile.
			terrainType := "ground"

			// Use the random number to determine the terrain type.
			if noise > 0.95 {
				terrainType = "rock"
				// If it's a rock, set its initial health.
				healthPipe.HSet(ctx, healthKey, coordKey, HealthRock)
			} else if noise > 0.90 {
				terrainType = "tree"
				// If it's a tree, set its initial health.
				healthPipe.HSet(ctx, healthKey, coordKey, HealthTree)
			} else if noise > 0.88 {
				terrainType = "water"
			}
			// Set the terrain type for the tile.
			worldPipe.HSet(ctx, worldKey, coordKey, terrainType)
		}
	}

	// Ensure the central spawn point (0,0) is always a clear ground tile.
	worldPipe.HSet(ctx, worldKey, "0,0", "ground")

	// Execute both pipelines to write all the data to Redis.
	_, err := worldPipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world terrain: %v", err)
	}
	_, err = healthPipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world health: %v", err)
	}

	log.Println("World generation complete.")
}
