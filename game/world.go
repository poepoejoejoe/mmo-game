package game

import (
	"log"
	"math/rand"
	"strconv"
)

// GenerateWorld creates the terrain in Redis if it doesn't already exist.
func GenerateWorld() {
	log.Println("Generating world terrain...")
	worldKey := "world:zone:0"
	if rdb.Exists(ctx, worldKey).Val() > 0 {
		log.Println("World already exists. Skipping generation.")
		return
	}
	pipe := rdb.Pipeline()
	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
			noise := rand.Float64()
			terrainType := "ground"
			if noise > 0.95 {
				terrainType = "rock"
			} else if noise > 0.90 {
				terrainType = "tree"
			} else if noise > 0.88 {
				terrainType = "water"
			}
			pipe.HSet(ctx, worldKey, coordKey, terrainType)
		}
	}
	pipe.HSet(ctx, worldKey, "0,0", "ground")
	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world: %v", err)
	}
	log.Println("World generation complete.")
}
