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

// GenerateSanctuary creates a sanctuary stone and a blob of sanctuary tiles around it.
// This function can be called after the initial world generation to add more sanctuaries.
func GenerateSanctuary(centerX, centerY, radius int) {
	log.Printf("Generating sanctuary at (%d, %d) with radius %d...", centerX, centerY, radius)
	pipe := rdb.Pipeline()

	// Create the sanctuary aura around the stone
	for x := centerX - radius; x <= centerX+radius; x++ {
		for y := centerY - radius; y <= centerY+radius; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
			var tile models.WorldTile

			if x == centerX && y == centerY {
				// Place the central stone
				tile.Type = string(TileTypeSanctuaryStone)
			} else {
				distSq := (x-centerX)*(x-centerX) + (y-centerY)*(y-centerY)
				// Check if the tile is within the blob radius
				if distSq < radius*radius && rand.Float64() < 1.0-float64(distSq)/float64(radius*radius) {
					// Only overwrite ground tiles to avoid placing sanctuaries in water, etc.
					existingTileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), coordKey).Result()
					if err == nil {
						var existingTile models.WorldTile
						if json.Unmarshal([]byte(existingTileJSON), &existingTile) == nil && existingTile.Type == string(TileTypeGround) {
							existingTile.IsSanctuary = true
							tile = existingTile
						}
					}
				}
			}

			if tile.Type != "" || tile.IsSanctuary {
				tileJSON, _ := json.Marshal(tile)
				pipe.HSet(ctx, string(RedisKeyWorldZone0), coordKey, string(tileJSON))
			}
		}
	}

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to generate sanctuary blob: %v", err)
	}
	log.Println("Sanctuary generation complete.")
}

func GenerateWorld() {
	log.Println("Generating world terrain and health...")
	worldKey := string(RedisKeyWorldZone0)

	if rdb.Exists(ctx, worldKey).Val() > 0 {
		log.Println("World already exists. Skipping generation.")
		return
	}

	p := perlin.NewPerlin(perlinAlpha, perlinBeta, perlinN, perlinSeed)
	pipe := rdb.Pipeline()

	// Define sanctuary locations and sizes
	sanctuaries := []struct{ x, y, radius int }{
		{0, 1, 8},   // Starting sanctuary at origin
		{10, 10, 5}, // Second sanctuary for testing
	}

	isSanctuaryTile := func(x, y int) (bool, bool) {
		for _, s := range sanctuaries {
			if x == s.x && y == s.y {
				return true, true // This is the center stone
			}

			// Use perlin noise to make the radius variable and the shape irregular
			noise := p.Noise2D(float64(x)/15.0, float64(y)/15.0)
			variableRadius := float64(s.radius) * (0.7 + (noise+1)/2*0.6) // Vary radius between 70% and 130%

			distSq := float64((x-s.x)*(x-s.x) + (y-s.y)*(y-s.y))
			if distSq < variableRadius*variableRadius {
				return true, false // It's a sanctuary tile, but not the center stone
			}
		}
		return false, false
	}

	for x := -WorldSize; x <= WorldSize; x++ {
		for y := -WorldSize; y <= WorldSize; y++ {
			coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)

			isSanctuary, isStone := isSanctuaryTile(x, y)
			var tile models.WorldTile

			if isStone {
				tile.Type = string(TileTypeSanctuaryStone)
				tile.IsSanctuary = true // Point 3: Tile under stone is a sanctuary
			} else if isSanctuary {
				// Point 1 & 2: Sanctuary tiles are continuous ground, no resources
				tile.Type = string(TileTypeGround)
				tile.IsSanctuary = true
			} else {
				// Standard terrain generation for non-sanctuary tiles
				noiseVal := p.Noise2D(float64(x)/10.0, float64(y)/10.0)

				tileType := TileTypeGround
				if noiseVal < -0.5 {
					tileType = TileTypeWater
				} else if noiseVal > 0.60 {
					tileType = TileTypeRock
				} else if noiseVal > 0.55 {
					tileType = TileTypeTree
				} else {
					if rand.Float64() > 0.98 {
						tileType = TileTypeTree
					}
				}
				tile.Type = string(tileType)
			}

			props := TileDefs[TileType(tile.Type)]
			tile.Health = props.MaxHealth

			tileJSON, _ := json.Marshal(tile)
			pipe.HSet(ctx, worldKey, coordKey, string(tileJSON))
		}
	}

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
