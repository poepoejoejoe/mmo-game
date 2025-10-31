package game

import (
	"encoding/json"
	"mmo-game/models"
	"time"
)

// TeleportActionHandler handles client teleport actions.
// This implements the ActionHandler interface for standardized action processing.
type TeleportActionHandler struct{}

// Process handles a teleport action request from the client.
// It initiates a channeling period before teleporting the player to their binding.
func (h *TeleportActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return Failed()
	}

	if _, ok := playerData["teleportingUntil"]; ok {
		// Already teleporting, do nothing
		return Failed()
	}

	binding, ok := playerData["binding"]
	if !ok || binding == "" {
		notification := CreateNotificationMessage("You have no binding point set.")
		SendPrivately(playerID, notification)
		return Failed()
	}

	// Start channeling (teleportChannelTime is defined in action_teleport.go)
	teleportCompleteAt := time.Now().Add(teleportChannelTime)
	rdb.HSet(ctx, playerID, "teleportingUntil", teleportCompleteAt.UnixMilli())

	// Build result messages
	result := NewActionResult()

	// Send channel start message
	channelStartMsg := map[string]interface{}{
		"type":     string(ServerEventTeleportChannelStart),
		"duration": teleportChannelTime.Milliseconds(),
	}
	channelStartJSON, _ := json.Marshal(channelStartMsg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    string(ServerEventTeleportChannelStart),
		Payload: channelStartJSON,
	})

	// Schedule the teleport to complete
	time.AfterFunc(teleportChannelTime, func() {
		completeTeleport(playerID, teleportCompleteAt)
	})

	return result
}

