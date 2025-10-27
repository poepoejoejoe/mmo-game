package game

import (
	"encoding/json"
	"log"
	"math/rand"
	"mmo-game/models"
	"strconv"
	"strings"
	"time"

	"github.com/aquilax/go-perlin"
	"github.com/go-redis/redis/v8"
)

const (
	perlinAlpha = 2.
	perlinBeta  = 2.
	perlinN     = 3
	perlinSeed  = 100
)

func GenerateWorld() {
	log.Println("Generating world terrain and health...")
	worldKey := string(RedisKeyWorldZone0)

	if rdb.Exists(ctx, worldKey).Val() > 0 {
		log.Println("World already exists. Skipping generation.")
		return
	}

	p := perlin.NewPerlin(perlinAlpha, perlinBeta, perlinN, perlinSeed)
	pipe := rdb.Pipeline()

	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)

			// Use Perlin noise for terrain generation
			// Scale the coordinates to control the "zoom" of the noise
			noiseVal := p.Noise2D(float64(x)/10.0, float64(y)/10.0)

			tileType := TileTypeGround
			if noiseVal < -0.5 {
				tileType = TileTypeWater
			} else if noiseVal > 0.60 {
				tileType = TileTypeRock
			} else if noiseVal > 0.55 {
				tileType = TileTypeTree
			} else {
				// Add a bit of randomness to ground tiles for variety
				if rand.Float64() > 0.98 {
					tileType = TileTypeTree
				}
			}

			props := TileDefs[tileType]
			tile := models.WorldTile{Type: string(tileType), Health: props.MaxHealth}

			tileJSON, _ := json.Marshal(tile)
			pipe.HSet(ctx, worldKey, coordKey, string(tileJSON))
		}
	}

	// Ensure spawn point is always ground
	spawnTileJSON, _ := json.Marshal(models.WorldTile{Type: string(TileTypeGround), Health: 0})
	pipe.HSet(ctx, worldKey, "0,0", spawnTileJSON)

	sanctuaryStoneTileJSON, _ := json.Marshal(models.WorldTile{Type: string(TileTypeSanctuaryStone)})
	pipe.HSet(ctx, worldKey, "0,-1", sanctuaryStoneTileJSON)

	fireTileJSON, _ := json.Marshal(models.WorldTile{Type: string(TileTypeFire)})
	pipe.HSet(ctx, worldKey, "0,1", fireTileJSON)

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Fatalf("Failed to generate world: %v", err)
	}

	// --- For Testing: Loot ownership ---
	// This needs to be done after the pipeline executes
	// Public item for anyone to pickup
	dropID, createdAt, publicAt, err := CreateWorldItem(1, 1, ItemWood, 1, "", 0)
	if err != nil {
		log.Printf("Failed to create test item: %v", err)
	} else {
		itemUpdate := map[string]interface{}{
			"type":       string(ServerEventEntityJoined),
			"entityId":   dropID,
			"entityType": string(EntityTypeItem),
			"itemId":     ItemWood,
			"x":          1,
			"y":          1,
			"owner":      "",
			"createdAt":  createdAt,
			"publicAt":   publicAt,
		}
		PublishUpdate(itemUpdate)
	}

	// owned item that will be public in 5 seconds
	dropID, createdAt, publicAt, err = CreateWorldItem(2, 2, ItemStone, 1, "aplayer", 5*time.Second)
	if err != nil {
		log.Printf("Failed to create test item: %v", err)
	} else {
		itemUpdate := map[string]interface{}{
			"type":       string(ServerEventEntityJoined),
			"entityId":   dropID,
			"entityType": string(EntityTypeItem),
			"itemId":     ItemStone,
			"x":          2,
			"y":          2,
			"owner":      "aplayer",
			"createdAt":  createdAt,
			"publicAt":   publicAt,
		}
		PublishUpdate(itemUpdate)
	}

	log.Println("World generation complete.")
}

func IndexWorldResources() {
	log.Println("Indexing world resources...")
	worldData, err := rdb.HGetAll(ctx, string(RedisKeyWorldZone0)).Result()
	if err != nil {
		log.Fatalf("Failed to get world data for indexing: %v", err)
	}

	pipe := rdb.Pipeline()
	count := 0
	for coord, tileJSON := range worldData {
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)
		props := TileDefs[TileType(tile.Type)]

		if props.IsGatherable {
			coords := strings.Split(coord, ",")
			x, _ := strconv.Atoi(coords[0])
			y, _ := strconv.Atoi(coords[1])

			// Member format: "tileType:x,y" e.g., "tree:10,20"
			member := tile.Type + ":" + coord
			pipe.GeoAdd(ctx, string(RedisKeyResourcePositions), &redis.GeoLocation{
				Name:      member,
				Longitude: float64(x),
				Latitude:  float64(y),
			})
			count++
		}
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error indexing world resources: %v", err)
	}
	log.Printf("Indexed %d resource locations.", count)
}

// GetWorldTile retrieves a single tile and its properties from the world data.
func GetWorldTile(x, y int) (*models.WorldTile, *TileProperties, error) {
	coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)

	tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), coordKey).Result()
	if err != nil {
		return nil, nil, err
	}

	var tile models.WorldTile
	if err := json.Unmarshal([]byte(tileJSON), &tile); err != nil {
		return nil, nil, err
	}

	props := TileDefs[TileType(tile.Type)]
	return &tile, &props, nil
}
