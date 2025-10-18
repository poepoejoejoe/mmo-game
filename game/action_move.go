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

	// Use MoveDirection constants
	switch MoveDirection(direction) {
	case MoveDirectionUp:
		targetY--
	case MoveDirectionDown:
		targetY++
	case MoveDirectionLeft:
		targetX--
	case MoveDirectionRight:
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
	// Use RedisKey constant
	targetTileKey := string(RedisKeyLockTile) + targetCoordKey
	wasSet, err := rdb.SetNX(ctx, targetTileKey, playerID, 0).Result()
	if err != nil || !wasSet {
		// Tile is locked, send state correction
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}
	}

	cooldown := BaseActionCooldown
	if props.MovementPenalty {
		cooldown = WaterMovePenalty
	}
	nextActionTime := time.Now().Add(cooldown).UnixMilli()

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "x", targetX, "y", targetY, "nextActionAt", nextActionTime)
	// Use RedisKey constant
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{Name: playerID, Longitude: float64(targetX), Latitude: float64(targetY)})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating player state, rolling back lock for tile %s", targetCoordKey)
		releaseLockScript.Run(ctx, rdb, []string{targetTileKey}, playerID)
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}
	}

	// Use RedisKey constant
	currentTileKey := string(RedisKeyLockTile) + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
	releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, playerID)

	// Use ServerEventType constant
	updateMsg := map[string]interface{}{"type": string(ServerEventPlayerMoved), "playerId": playerID, "x": targetX, "y": targetY}
	PublishUpdate(updateMsg)

	return nil
}
