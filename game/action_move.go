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
func ProcessMove(entityID string, direction MoveDirection) *models.StateCorrectionMessage {
	// Use new generic helper
	canAct, entityData := CanEntityAct(entityID)
	if !canAct {
		return nil
	}

	// Use new generic helper
	currentX, currentY := GetEntityPosition(entityData)
	targetX, targetY := currentX, currentY

	// Use MoveDirection constants
	switch direction {
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

	// Lock the tile for the entity
	wasSet, err := LockTileForEntity(entityID, targetX, targetY)
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

	// --- BUG FIX REVERT: Use a single GeoAdd to correctly update the GeoSet position ---
	// GeoAdd correctly adds a new member or updates the position of an existing one.
	// The previous ZAdd call was incorrect and corrupted the location data.
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      entityID,
		Longitude: float64(targetX),
		Latitude:  float64(targetY),
	})

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating entity state, rolling back lock for tile %d,%d", targetX, targetY)
		UnlockTileForEntity(entityID, targetX, targetY)
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}
	}

	// Release the lock using the entity's ID
	UnlockTileForEntity(entityID, currentX, currentY)

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
