package game

import (
	"encoding/json"
	"log"
	"strconv"
)

// ToggleEchoActionHandler handles client toggle echo actions.
// This implements the ActionHandler interface for standardized action processing.
type ToggleEchoActionHandler struct{}

// Process handles a toggle echo action request from the client.
// It toggles the player's echo state if they have sufficient resonance.
func (h *ToggleEchoActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	// ToggleEcho doesn't use payload, but we still need to accept it for the interface
	_ = payload

	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Error getting player data for echo toggle %s: %v", playerID, err)
		return Failed()
	}

	isEcho, _ := strconv.ParseBool(playerData["isEcho"])
	resonance, _ := strconv.ParseInt(playerData["resonance"], 10, 64)

	if !isEcho && resonance <= 0 {
		// Can't activate echo without resonance
		return Failed()
	}

	log.Printf("Player %s toggled echo state to: %v", playerID, !isEcho)
	SetEchoState(playerID, !isEcho)

	// SetEchoState already handles sending updates, so we just return success
	return NewActionResult()
}

