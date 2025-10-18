package game

import (
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// --- UPDATED ---
// ProcessMove now handles any entity, not just players.
func ProcessMove(entityID string, direction string) *models.StateCorrectionMessage {
	// Use new generic helper
	canAct, entityData := CanEntityAct(entityID)
	if !canAct {
		return nil
	}

	// Use new generic helper
	currentX, currentY := GetEntityPosition(entityData)
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
	// Lock the tile for the entity
	wasSet, err := rdb.SetNX(ctx, targetTileKey, entityID, 0).Result()
	if err != nil || !wasSet {
		// Tile is locked, send state correction
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}
	}

	// --- UPDATED COOLDOWN LOGIC ---
	var cooldown int64 = 1000 // Default cooldown
	if props.MovementPenalty {
		cooldown = 1500 // Water move penalty
	} else {
		// Check for a specific move cooldown on the entity
		if moveCooldownStr, ok := entityData["moveCooldown"]; ok {
			if mc, err := strconv.ParseInt(moveCooldownStr, 10, 64); err == nil {
				cooldown = mc
			}
		}
	}
	nextActionTime := time.Now().Add(time.Duration(cooldown) * time.Millisecond).UnixMilli()
	// --- END UPDATED COOLDOWN LOGIC ---

	pipe := rdb.Pipeline()
	// Update the entity's hash
	pipe.HSet(ctx, entityID, "x", targetX, "y", targetY, "nextActionAt", nextActionTime)
	// Use RedisKey constant and update the entity's GeoSet position
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{Name: entityID, Longitude: float64(targetX), Latitude: float64(targetY)})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating entity state, rolling back lock for tile %s", targetCoordKey)
		releaseLockScript.Run(ctx, rdb, []string{targetTileKey}, entityID)
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}
	}

	// Use RedisKey constant
	currentTileKey := string(RedisKeyLockTile) + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
	// Release the lock using the entity's ID
	releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, entityID)

	// --- UPDATED MESSAGE ---
	// Use new ServerEventType constant and generic "entityId"
	updateMsg := map[string]interface{}{
		"type":     string(ServerEventEntityMoved),
		"entityId": entityID,
		"x":        targetX,
		"y":        targetY,
	}
	PublishUpdate(updateMsg)

	return nil
}
