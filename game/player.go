package game

import (
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

func FindOpenSpawnPoint(playerID string) (int, int) {
	// ... (no changes in this function's logic)
	x, y, dx, dy := 0, 0, 0, -1
	for i := 0; i < (WorldSize * 2); i++ {
		for j := 0; j < (i/2 + 1); j++ {
			tileKey := "lock:tile:" + strconv.Itoa(x) + "," + strconv.Itoa(y)
			wasSet, _ := rdb.SetNX(ctx, tileKey, playerID, 0).Result()
			if wasSet {
				terrainType, _ := rdb.HGet(ctx, "world:zone:0", strconv.Itoa(x)+","+strconv.Itoa(y)).Result()
				if terrainType != "rock" && terrainType != "tree" {
					return x, y
				}
			}
			x, y = x+dx, y+dy
		}
		dx, dy = -dy, dx
	}
	return 0, 0
}

func InitializePlayer(playerID string) *models.InitialStateMessage {
	log.Printf("Player %s connected.", playerID)
	spawnX, spawnY := FindOpenSpawnPoint(playerID)

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "x", spawnX, "y", spawnY, "canMoveAt", time.Now().UnixMilli())
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{Name: playerID, Longitude: float64(spawnX), Latitude: float64(spawnY)})
	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		return nil
	}

	locations, _ := rdb.GeoRadius(ctx, "zone:0:positions", 0, 0, &redis.GeoRadiusQuery{Radius: 99999, Unit: "km", WithCoord: true}).Result()
	allPlayersState := make(map[string]models.PlayerState)
	for _, loc := range locations {
		allPlayersState[loc.Name] = models.PlayerState{X: int(loc.Longitude), Y: int(loc.Latitude)}
	}
	worldData, _ := rdb.HGetAll(ctx, "world:zone:0").Result()

	initialState := &models.InitialStateMessage{
		Type:     "initial_state",
		PlayerId: playerID,
		Players:  allPlayersState,
		World:    worldData,
	}

	joinMsg := map[string]interface{}{"type": "player_joined", "playerId": playerID, "x": spawnX, "y": spawnY}
	PublishUpdate(joinMsg)

	return initialState
}

func CleanupPlayer(playerID string) {
	log.Printf("Player %s disconnected.", playerID)
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err == nil {
		currentX, _ := strconv.Atoi(playerData["x"])
		currentY, _ := strconv.Atoi(playerData["y"])
		currentTileKey := "lock:tile:" + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
		releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, playerID)
	}

	pipe := rdb.Pipeline()
	pipe.Del(ctx, playerID)
	pipe.ZRem(ctx, "zone:0:positions", playerID)
	pipe.Exec(ctx)

	leftMsg := map[string]interface{}{"type": "player_left", "playerId": playerID}
	PublishUpdate(leftMsg)
}
