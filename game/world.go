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
	// Use RedisKey constant
	worldKey := string(RedisKeyWorldZone0)

	if rdb.Exists(ctx, worldKey).Val() > 0 {
		log.Println("World already exists. Skipping generation.")
		return
	}

	pipe := rdb.Pipeline()
	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
			noise := rand.Float64()
			// Use TileType constants
			tileType := TileTypeGround

			if noise > 0.95 {
				tileType = TileTypeRock
			} else if noise > 0.90 {
				tileType = TileTypeTree
			} else if noise > 0.88 {
				tileType = TileTypeWater
			}

			// Get properties from our new definition map by casting
			props := TileDefs[tileType]
			tile := models.WorldTile{Type: string(tileType), Health: props.MaxHealth}

			tileJSON, _ := json.Marshal(tile)
			pipe.HSet(ctx, worldKey, coordKey, string(tileJSON))
		}
	}

	// Use TileType constant
	spawnTileJSON, _ := json.Marshal(models.WorldTile{Type: string(TileTypeGround), Health: 0})
	pipe.HSet(ctx, worldKey, "0,0", spawnTileJSON)

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world: %v", err)
	}
	log.Println("World generation complete.")
}
