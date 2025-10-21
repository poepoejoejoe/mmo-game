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

	// --- For Testing: Place a fire and an item on it ---
	fireTileJSON, _ := json.Marshal(models.WorldTile{Type: string(TileTypeFire)})
	pipe.HSet(ctx, worldKey, "3,3", fireTileJSON)
	// --- End For Testing ---

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world: %v", err)
	}

	// --- For Testing: Place an item on the fire ---
	// This needs to be done after the pipeline executes
	dropID, createdAt, err := CreateWorldItem(3, 3, ItemRatMeat, 1, "", 0)
	if err != nil {
		log.Printf("Failed to create test item: %v", err)
	} else {
		itemUpdate := map[string]interface{}{
			"type":       string(ServerEventEntityJoined),
			"entityId":   dropID,
			"entityType": string(EntityTypeItem),
			"itemId":     ItemRatMeat,
			"x":          3,
			"y":          3,
			"owner":      "",
			"createdAt":  createdAt,
		}
		PublishUpdate(itemUpdate)
	}
	// --- End For Testing ---

	log.Println("World generation complete.")
}
