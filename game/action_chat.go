package game

import (
	"context"
	"encoding/json"
	"log"
	"mmo-game/models"
)

func ProcessSendChat(playerID string, payload json.RawMessage) {
	var chatData models.SendChatMessage
	if err := json.Unmarshal(payload, &chatData); err != nil {
		log.Printf("error unmarshalling chat payload: %v", err)
		return
	}

	// Basic validation
	if len(chatData.Message) == 0 || len(chatData.Message) > 100 {
		return
	}

	ctx := context.Background()
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil || len(playerData) == 0 {
		return
	}
	x, y := GetEntityPosition(playerData)

	// Define chat radius
	const chatRadius = 10

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
	for _, nearbyID := range nearbyPlayerIDs {
		PublishToPlayer(nearbyID, chatJSON)
	}
}
