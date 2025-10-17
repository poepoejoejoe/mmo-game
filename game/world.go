package game

import (
	"encoding/json"
	"log"
	"math/rand"
	"mmo-game/models"
	"strconv"
)

func GenerateWorld() {
	log.Println("Generating world terrain and health...")
	worldKey := "world:zone:0"

	if rdb.Exists(ctx, worldKey).Val() > 0 {
		log.Println("World already exists in Redis. Skipping generation.")
		return
	}

	pipe := rdb.Pipeline()
	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
			noise := rand.Float64()
			tile := models.WorldTile{Type: "ground", Health: 0}

			if noise > 0.95 {
				tile = models.WorldTile{Type: "rock", Health: HealthRock}
			} else if noise > 0.90 {
				tile = models.WorldTile{Type: "tree", Health: HealthTree}
			} else if noise > 0.88 {
				tile = models.WorldTile{Type: "water", Health: 0}
			}

			// Marshal the struct to a JSON string to store in Redis
			tileJSON, _ := json.Marshal(tile)
			pipe.HSet(ctx, worldKey, coordKey, string(tileJSON))
		}
	}

	// Ensure spawn is clear
	spawnTileJSON, _ := json.Marshal(models.WorldTile{Type: "ground", Health: 0})
	pipe.HSet(ctx, worldKey, "0,0", spawnTileJSON)

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world: %v", err)
	}
	log.Println("World generation complete.")
}
