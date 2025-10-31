package game

import (
	"encoding/json"
	"mmo-game/models"
)

// MoveActionHandler handles client move actions.
// This implements the ActionHandler interface for standardized action processing.
type MoveActionHandler struct{}

// Process handles a move action request from the client.
// It validates the move, updates the entity position, and returns appropriate messages.
func (h *MoveActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var moveData models.MovePayload
	if err := json.Unmarshal(payload, &moveData); err != nil {
		return Failed()
	}

	// Use the existing ProcessMove function for backward compatibility with AI system
	correctionMsg := ProcessMove(playerID, MoveDirection(moveData.Direction))
	
	result := NewActionResult()
	
	// If move failed, send state correction to player
	if correctionMsg != nil {
		correctionJSON, _ := json.Marshal(correctionMsg)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    correctionMsg.Type,
			Payload: correctionJSON,
		})
		// Note: ProcessMove already broadcasts entity movement if successful,
		// so we don't need to add broadcast messages here
		return result
	}
	
	// Move was successful - ProcessMove already handles broadcasting the update
	return result
}

