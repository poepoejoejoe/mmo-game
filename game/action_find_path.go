package game

import (
	"encoding/json"
	"mmo-game/models"
)

func ProcessFindPath(playerID string, payload models.FindPathPayload) (*models.WebSocketMessage, *models.WebSocketMessage) {
	playerX, playerY, err := getPlayerPosition(playerID)
	if err != nil {
		return nil, nil
	}

	tickCache := &TickCache{
		CollisionGrid: BuildCollisionGrid(),
		LockedTiles:   make(map[string]bool),
	}

	path := FindPath(playerX, playerY, payload.X, payload.Y, tickCache)

	if path == nil || len(path) == 0 {
		noValidPathMsg := &models.WebSocketMessage{
			Type: string(ServerEventNoValidPath),
		}
		return noValidPathMsg, nil
	}

	directions := convertPathToDirections(path)

	validPathPayload := models.ValidPathPayload{
		Directions: directions,
	}
	payloadBytes, _ := json.Marshal(validPathPayload)

	validPathMsg := &models.WebSocketMessage{
		Type:    string(ServerEventValidPath),
		Payload: payloadBytes,
	}

	return nil, validPathMsg
}

func convertPathToDirections(path []*Node) []string {
	if len(path) < 2 {
		return []string{}
	}

	directions := make([]string, 0, len(path)-1)
	for i := 0; i < len(path)-1; i++ {
		currentNode := path[i]
		nextNode := path[i+1]

		dx := nextNode.X - currentNode.X
		dy := nextNode.Y - currentNode.Y

		if dx == 1 && dy == 0 {
			directions = append(directions, "right")
		} else if dx == -1 && dy == 0 {
			directions = append(directions, "left")
		} else if dx == 0 && dy == 1 {
			directions = append(directions, "down")
		} else if dx == 0 && dy == -1 {
			directions = append(directions, "up")
		}
	}
	return directions
}
