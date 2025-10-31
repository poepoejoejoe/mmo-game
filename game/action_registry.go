package game

import (
	"encoding/json"
	"log"
)

// ActionHandler is the interface that all action handlers must implement.
// This standardizes how actions are processed, making it easier to add new actions
// by following a consistent pattern.
type ActionHandler interface {
	// Process handles the action and returns a standardized ActionResult.
	// playerID is the ID of the player performing the action.
	// payload is the raw JSON payload from the client.
	Process(playerID string, payload json.RawMessage) *ActionResult
}

// ActionRegistry maintains a mapping of client event types to their handlers.
// This allows automatic routing of actions without maintaining a large switch statement.
var ActionRegistry = make(map[ClientEventType]ActionHandler)

// RegisterAction registers an action handler for a specific client event type.
// This should be called during package initialization (init() functions).
//
// Example:
//   RegisterAction(ClientEventMove, &MoveActionHandler{})
func RegisterAction(eventType ClientEventType, handler ActionHandler) {
	if ActionRegistry[eventType] != nil {
		log.Printf("WARNING: Action handler for %s is being overwritten", eventType)
	}
	ActionRegistry[eventType] = handler
}

// HandleAction processes an action using the registry.
// This is called from handlers.go to route client messages to the appropriate handler.
//
// Returns the ActionResult if the action was handled, or nil if no handler was found.
func HandleAction(eventType ClientEventType, playerID string, payload json.RawMessage) *ActionResult {
	handler, exists := ActionRegistry[eventType]
	if !exists {
		log.Printf("No handler registered for event type: %s", eventType)
		return Failed()
	}

	result := handler.Process(playerID, payload)
	if result == nil {
		return Failed()
	}

	return result
}

