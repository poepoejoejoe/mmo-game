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

// --- UPDATED ---
// ProcessMove now handles any entity, not just players.
func ProcessMove(entityID string, direction MoveDirection) *models.StateCorrectionMessage {
	// Use new generic helper
	canAct, entityData := CanEntityAct(entityID)
	if !canAct {
		return nil
	}

	// --- CANCEL TELEPORT IF PLAYER MOVES ---
	// If a player is teleporting and attempts to move, cancel the teleport
	if strings.HasPrefix(entityID, "player:") {
		if _, ok := entityData["teleportingUntil"]; ok {
			// Cancel the teleport by removing the teleportingUntil field
			rdb.HDel(ctx, entityID, "teleportingUntil")

			// Notify the client that the teleport channel was canceled
			channelEndMsg := map[string]interface{}{"type": string(ServerEventTeleportChannelEnd)}
			msgJSON, _ := json.Marshal(channelEndMsg)
			sendDirectMessage(entityID, msgJSON)
		}
	}
	// --- END CANCEL TELEPORT ---

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

	tile, props, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return nil // Tile doesn't exist or other error
	}

	// --- NEW: Prevent NPCs from entering sanctuaries ---
	if strings.HasPrefix(entityID, "npc:") {
		if tile.IsSanctuary {
			return nil // NPC runs into a sanctuary, treat as a wall
		}
	}
	// --- END NEW ---

	if props.IsCollidable {
		return nil // Ran into a wall
	}

	// Lock the tile for the entity, unless it's a sanctuary
	if !tile.IsSanctuary {
		wasSet, err := LockTileForEntity(entityID, targetX, targetY)
		if err != nil || !wasSet {
			// Tile is locked, send state correction
			return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}
		}
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
	lon, lat := NormalizeCoords(targetX, targetY)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      entityID,
		Longitude: lon,
		Latitude:  lat,
	})

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating entity state, rolling back lock for tile %d,%d", targetX, targetY)
		// Release the lock using the entity's ID, if it was set
		if !tile.IsSanctuary {
			UnlockTileForEntity(entityID, targetX, targetY)
		}
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}
	}

	// Get info about the source tile to decide whether to unlock it.
	sourceTile, _, err := GetWorldTile(currentX, currentY)
	if err != nil {
		log.Printf("Could not get source tile %d,%d for unlocking: %v", currentX, currentY, err)
	}

	// Release the lock on the previous tile, if the entity was on a non-sanctuary tile.
	if sourceTile == nil || !sourceTile.IsSanctuary {
		UnlockTileForEntity(entityID, currentX, currentY)
	}

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
