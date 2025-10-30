package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

const (
	resourceCheckInterval = 20 * time.Second
)

func StartResourceSpawner() {
	go func() {
		ticker := time.NewTicker(resourceCheckInterval)
		defer ticker.Stop()

		for range ticker.C {
			checkAndSpawnResources()
		}
	}()
}

func checkAndSpawnResources() {
	resourceCounts := make(map[TileType]int)
	for _, tileType := range []TileType{TileTypeTree, TileTypeRock, TileTypeIronRock} {
		resourceCounts[tileType] = 0
	}

	members, err := rdb.ZRange(ctx, string(RedisKeyResourcePositions), 0, -1).Result()
	if err != nil {
		log.Printf("Error getting resource positions: %v", err)
		return
	}

	for _, member := range members {
		parts := strings.Split(member, ":")
		if len(parts) > 0 {
			tileType := TileType(parts[0])
			if _, ok := resourceCounts[tileType]; ok {
				resourceCounts[tileType]++
			}
		}
	}

	for tileType, target := range ResourceTargets {
		currentCount := resourceCounts[tileType]
		if currentCount < target {
			spawnResources(tileType, target-currentCount)
		}
	}
}

func spawnResources(tileType TileType, count int) {
	log.Printf("Spawning %d of %s", count, tileType)
	redisKey := "potential_spawns:" + string(tileType)

	numToTry := count * 5
	if numToTry < 20 {
		numToTry = 20
	}

	potentialCoords, err := rdb.SRandMemberN(ctx, redisKey, int64(numToTry)).Result()
	if err != nil {
		log.Printf("Error getting random spawn points for %s: %v", tileType, err)
		return
	}

	spawnedCount := 0
	for _, coordKey := range potentialCoords {
		if spawnedCount >= count {
			break
		}

		coords := strings.Split(coordKey, ",")
		x, _ := strconv.Atoi(coords[0])
		y, _ := strconv.Atoi(coords[1])

		tile, _, err := GetWorldTile(x, y)
		if err == nil && tile.Type == string(TileTypeGround) && !tile.IsSanctuary {
			spawnResourceAt(x, y, tileType)
			spawnedCount++
		}
	}

	if spawnedCount < count {
		log.Printf("Only spawned %d/%d of %s. Not enough available ground tiles in natural habitat.", spawnedCount, count, tileType)
	}
}

func spawnResourceAt(x, y int, tileType TileType) {
	props := TileDefs[tileType]
	newTile := models.WorldTile{
		Type:   string(tileType),
		Health: props.MaxHealth,
	}

	coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
	newTileJSON, _ := json.Marshal(newTile)

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, string(RedisKeyWorldZone0), coordKey, string(newTileJSON))

	member := string(tileType) + ":" + coordKey
	pipe.GeoAdd(ctx, string(RedisKeyResourcePositions), &redis.GeoLocation{
		Name:      member,
		Longitude: float64(x),
		Latitude:  float64(y),
	})

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to spawn resource at (%d, %d): %v", x, y, err)
		return
	}

	worldUpdateMsg := models.WorldUpdateMessage{
		Type: string(ServerEventWorldUpdate),
		X:    x,
		Y:    y,
		Tile: newTile,
	}
	PublishUpdate(worldUpdateMsg)
}
