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
		log.Println("World already exists. Skipping generation.")
		return
	}

	pipe := rdb.Pipeline()
	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
			noise := rand.Float64()
			tileType := "ground"

			if noise > 0.95 {
				tileType = "rock"
			} else if noise > 0.90 {
				tileType = "tree"
			} else if noise > 0.88 {
				tileType = "water"
			}

			// Get properties from our new definition map
			props := TileDefs[tileType]
			tile := models.WorldTile{Type: tileType, Health: props.MaxHealth}

			tileJSON, _ := json.Marshal(tile)
			pipe.HSet(ctx, worldKey, coordKey, string(tileJSON))
		}
	}

	spawnTileJSON, _ := json.Marshal(models.WorldTile{Type: "ground", Health: 0})
	pipe.HSet(ctx, worldKey, "0,0", spawnTileJSON)

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world: %v", err)
	}
	log.Println("World generation complete.")
}
