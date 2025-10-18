package game

import (
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

func ProcessMove(playerID string, direction string) *models.StateCorrectionMessage {
	canAct, playerData := CanPlayerAct(playerID)
	if !canAct {
		return nil
	}

	currentX, currentY := GetPlayerPosition(playerData)
	targetX, targetY := currentX, currentY
	switch direction {
	case "up":
		targetY--
	case "down":
		targetY++
	case "left":
		targetX--
	case "right":
		targetX++
	}

	_, props, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return nil // Tile doesn't exist or other error
	}

	if props.IsCollidable {
		return nil // Ran into a wall
	}

	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)
	targetTileKey := "lock:tile:" + targetCoordKey
	wasSet, err := rdb.SetNX(ctx, targetTileKey, playerID, 0).Result()
	if err != nil || !wasSet {
		// Tile is locked, send state correction
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}
	}

	cooldown := BaseActionCooldown
	if props.MovementPenalty {
		cooldown = WaterMovePenalty
	}
	nextActionTime := time.Now().Add(cooldown).UnixMilli()

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "x", targetX, "y", targetY, "nextActionAt", nextActionTime)
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{Name: playerID, Longitude: float64(targetX), Latitude: float64(targetY)})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating player state, rolling back lock for tile %s", targetCoordKey)
		releaseLockScript.Run(ctx, rdb, []string{targetTileKey}, playerID)
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}
	}

	currentTileKey := "lock:tile:" + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
	releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, playerID)

	updateMsg := map[string]interface{}{"type": "player_moved", "playerId": playerID, "x": targetX, "y": targetY}
	PublishUpdate(updateMsg)

	return nil
}
