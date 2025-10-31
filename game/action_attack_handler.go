package game

import (
	"encoding/json"
	"mmo-game/models"
)

// AttackActionHandler handles client attack actions.
// This implements the ActionHandler interface for standardized action processing.
type AttackActionHandler struct{}

// Process handles an attack action request from the client.
// It validates the attack, calculates damage, and returns appropriate messages.
func (h *AttackActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var attackData models.AttackPayload
	if err := json.Unmarshal(payload, &attackData); err != nil {
		return Failed()
	}

	// Use the existing ProcessAttack function for backward compatibility
	damageMsg := ProcessAttack(playerID, attackData.EntityID)
	
	if damageMsg == nil {
		return Failed()
	}

	result := NewActionResult()
	
	// ProcessAttack already broadcasts the damage message via PublishUpdate,
	// but we also need to send it to the player who attacked
	damageJSON, _ := json.Marshal(damageMsg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    damageMsg.Type,
		Payload: damageJSON,
	})
	
	// Note: ProcessAttack already broadcasts via PublishUpdate, so we don't need
	// to add broadcast messages here. The broadcast happens synchronously in ProcessAttack.
	
	return result
}

