package game

import "mmo-game/models"

// ActionResult represents the standardized return value from an action handler.
// It contains all messages that should be sent to the client(s) as a result of the action.
// Messages are categorized by their destination to make routing clear.
type ActionResult struct {
	// ToPlayer contains messages that should be sent only to the player who performed the action.
	// These are typically private updates like inventory changes, health updates, etc.
	ToPlayer []models.WebSocketMessage

	// ToBroadcast contains messages that should be broadcast to all players.
	// These are typically world updates, entity movements, etc.
	ToBroadcast []models.WebSocketMessage

	// Success indicates whether the action was successfully processed.
	// If false, no messages should be sent (action was invalid/blocked).
	Success bool
}

// NewActionResult creates a new ActionResult with success=true.
func NewActionResult() *ActionResult {
	return &ActionResult{
		ToPlayer:    make([]models.WebSocketMessage, 0),
		ToBroadcast: make([]models.WebSocketMessage, 0),
		Success:     true,
	}
}

// AddToPlayer adds a message to be sent to the player who performed the action.
func (r *ActionResult) AddToPlayer(msg models.WebSocketMessage) {
	r.ToPlayer = append(r.ToPlayer, msg)
}

// AddToBroadcast adds a message to be broadcast to all players.
func (r *ActionResult) AddToBroadcast(msg models.WebSocketMessage) {
	r.ToBroadcast = append(r.ToBroadcast, msg)
}

// Failed creates an ActionResult indicating the action failed.
// This is a convenience method for validation failures.
func Failed() *ActionResult {
	return &ActionResult{
		Success: false,
	}
}

