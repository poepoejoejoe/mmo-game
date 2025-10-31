package game

import "log"

// ActionError represents an error that occurred during action processing.
// This type helps distinguish action errors from other types of errors.
type ActionError struct {
	Action  string
	PlayerID string
	Message string
	Err     error
}

func (e *ActionError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

// LogActionError logs an error that occurred during action processing.
// This provides consistent error logging across all actions.
//
// Usage:
//   if err != nil {
//       LogActionError("MyAction", playerID, "Failed to process action", err)
//       return Failed()
//   }
func LogActionError(action string, playerID string, message string, err error) {
	if err != nil {
		log.Printf("[%s] Player %s: %s - %v", action, playerID, message, err)
	} else {
		log.Printf("[%s] Player %s: %s", action, playerID, message)
	}
}

// LogActionSuccess logs a successful action execution.
// Useful for debugging and monitoring.
//
// Usage:
//   LogActionSuccess("MyAction", playerID, "Processed successfully")
func LogActionSuccess(action string, playerID string, message string) {
	log.Printf("[%s] Player %s: %s", action, playerID, message)
}

// Common error messages for consistency
const (
	ErrInvalidPayload    = "invalid payload format"
	ErrCannotAct         = "entity cannot act (cooldown or dead)"
	ErrMissingItem       = "player does not have required item"
	ErrInvalidTarget     = "invalid target for action"
	ErrOutOfRange        = "target is out of range"
	ErrInvalidState      = "invalid game state for action"
	ErrRedisError        = "Redis operation failed"
	ErrInventoryFull     = "inventory is full"
	ErrBankFull          = "bank is full"
	ErrInvalidSlot       = "invalid inventory slot"
	ErrInvalidQuantity   = "invalid item quantity"
	ErrNotAdjacent       = "target is not adjacent"
	ErrItemNotFound      = "item not found in inventory"
	ErrInsufficientItems = "insufficient items in inventory"
)

