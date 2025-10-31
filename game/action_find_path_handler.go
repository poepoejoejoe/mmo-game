package game

import (
	"encoding/json"
	"mmo-game/models"
)

// FindPathActionHandler handles client find path actions.
// This implements the ActionHandler interface for standardized action processing.
type FindPathActionHandler struct{}

// Process handles a find path action request from the client.
// It calculates a path from the player's current position to the target and returns directions.
func (h *FindPathActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var findPathData models.FindPathPayload
	if err := json.Unmarshal(payload, &findPathData); err != nil {
		return Failed()
	}

	playerX, playerY, err := getPlayerPosition(playerID)
	if err != nil {
		return Failed()
	}

	tickCache := &TickCache{
		CollisionGrid: BuildCollisionGrid(),
		LockedTiles:   make(map[string]bool),
	}

	path := FindPath(playerX, playerY, findPathData.X, findPathData.Y, tickCache)

	// Build result messages
	result := NewActionResult()

	if path == nil || len(path) == 0 {
		// No valid path found
		noValidPathMsg := &models.WebSocketMessage{
			Type: string(ServerEventNoValidPath),
		}
		noValidPathJSON, _ := json.Marshal(noValidPathMsg)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    noValidPathMsg.Type,
			Payload: noValidPathJSON,
		})
		return result
	}

	// Valid path found - convert to directions
	directions := convertPathToDirections(path)
	validPathMsg := &models.ValidPathMessage{
		Type:       string(ServerEventValidPath),
		Directions: directions,
	}
	validPathJSON, _ := json.Marshal(validPathMsg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    validPathMsg.Type,
		Payload: validPathJSON,
	})

	return result
}

