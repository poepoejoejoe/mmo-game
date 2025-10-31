package game

import (
	"context"
	"encoding/json"
	"log"
	"mmo-game/models"
)

// SendChatActionHandler handles client chat actions.
// This implements the ActionHandler interface for standardized action processing.
type SendChatActionHandler struct{}

// Process handles a send chat action request from the client.
// It validates the message and broadcasts it to nearby players.
func (h *SendChatActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var chatData models.SendChatMessage
	if err := json.Unmarshal(payload, &chatData); err != nil {
		log.Printf("error unmarshalling chat payload: %v", err)
		return Failed()
	}

	// Basic validation
	if len(chatData.Message) == 0 || len(chatData.Message) > MaxChatMessageLength {
		return Failed()
	}

	ctx := context.Background()
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil || len(playerData) == 0 {
		return Failed()
	}
	x, y := GetEntityPosition(playerData)

	// Define chat radius
	const chatRadius = ChatRadius

	// Find nearby players (including self)
	nearbyPlayerIDs := GetEntitiesInRange(x, y, chatRadius, EntityTypePlayer)

	// Create the message to broadcast
	chatMessage := models.PlayerChatMessage{
		Type:     "player_chat",
		PlayerID: playerID,
		Message:  chatData.Message,
	}
	chatJSON, _ := json.Marshal(chatMessage)

	// Send the message to all nearby players
	// Note: Chat uses PublishToPlayer which sends directly, bypassing ActionResult
	// This is acceptable for chat since it needs immediate broadcast to multiple players
	for _, nearbyID := range nearbyPlayerIDs {
		PublishToPlayer(nearbyID, chatJSON)
	}

	// Chat doesn't need a response message, so we return success with empty result
	return NewActionResult()
}

