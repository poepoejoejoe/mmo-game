package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"time"
)

// SetRuneActionHandler handles client set rune actions.
// This implements the ActionHandler interface for standardized action processing.
type SetRuneActionHandler struct{}

// Process handles a set rune action request from the client.
// It sets the player's active rune for echo behavior.
func (h *SetRuneActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var p models.SetRunePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		return Failed()
	}

	// TODO: Validate that the player actually has this rune.
	// For now, we'll trust the client.

	rdb.HSet(ctx, playerID, "activeRune", p.Rune)
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	log.Printf("Player %s set active rune to %s", playerID, p.Rune)

	// Build result messages
	result := NewActionResult()

	// Send active rune update
	updateMsg := map[string]interface{}{
		"type":       string(ServerEventActiveRuneUpdate),
		"activeRune": p.Rune,
	}
	updateMsgJSON, _ := json.Marshal(updateMsg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    string(ServerEventActiveRuneUpdate),
		Payload: updateMsgJSON,
	})

	return result
}

