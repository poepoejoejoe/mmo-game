package game

import (
	"encoding/json"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

const teleportChannelTime = 3 * time.Second

func ProcessTeleport(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return nil, nil
	}

	if _, ok := playerData["teleportingUntil"]; ok {
		// Already teleporting, do nothing.
		return nil, nil
	}

	binding, ok := playerData["binding"]
	if !ok || binding == "" {
		sendNotification(playerID, "You have no binding point set.")
		return nil, nil
	}

	// --- Start Channeling ---
	teleportCompleteAt := time.Now().Add(teleportChannelTime)
	rdb.HSet(ctx, playerID, "teleportingUntil", teleportCompleteAt.UnixMilli())

	channelStartMsg := map[string]interface{}{
		"type":     string(ServerEventTeleportChannelStart),
		"duration": teleportChannelTime.Milliseconds(),
	}
	msgJSON, _ := json.Marshal(channelStartMsg)
	sendDirectMessage(playerID, msgJSON)

	// Schedule the teleport to complete
	time.AfterFunc(teleportChannelTime, func() {
		completeTeleport(playerID, teleportCompleteAt)
	})

	return nil, nil
}

func completeTeleport(playerID string, expectedCompleteTime time.Time) {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return // Player might have disconnected
	}

	teleportingUntilStr, ok := playerData["teleportingUntil"]
	if !ok {
		// Teleport was canceled (e.g., by taking damage)
		return
	}
	teleportingUntil, _ := strconv.ParseInt(teleportingUntilStr, 10, 64)

	// Check if the timestamp matches, ensuring this isn't a stale AfterFunc call
	if teleportingUntil != expectedCompleteTime.UnixMilli() {
		return
	}

	// Clear the teleporting state
	rdb.HDel(ctx, playerID, "teleportingUntil")

	destX, destY := GetPlayerSpawnPoint(playerID, playerData)

	oldX, _ := strconv.Atoi(playerData["x"])
	oldY, _ := strconv.Atoi(playerData["y"])
	UnlockTileForEntity(playerID, oldX, oldY)
	LockTileForEntity(playerID, destX, destY)

	rdb.HSet(ctx, playerID, "x", destX, "y", destY)
	rdb.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      playerID,
		Longitude: float64(destX),
		Latitude:  float64(destY),
	})

	moveUpdate := map[string]interface{}{
		"type":      string(ServerEventEntityMoved),
		"entityId":  playerID,
		"x":         destX,
		"y":         destY,
		"direction": playerData["direction"],
	}
	PublishUpdate(moveUpdate)
	sendNotification(playerID, "You have teleported to your binding.")

	// Notify client that channel is over
	channelEndMsg := map[string]interface{}{"type": string(ServerEventTeleportChannelEnd)}
	msgJSON, _ := json.Marshal(channelEndMsg)
	sendDirectMessage(playerID, msgJSON)
}

func sendNotification(playerID, message string) {
	notification := models.NotificationMessage{
		Type:    string(ServerEventNotification),
		Message: message,
	}
	notificationJSON, _ := json.Marshal(notification)
	sendDirectMessage(playerID, notificationJSON)
}
