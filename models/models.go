package models

import (
	"encoding/json"
)

type WebSocketMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type MovePayload struct {
	Direction string `json:"direction"`
}

type PlayerState struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type InitialStateMessage struct {
	Type     string                 `json:"type"`
	PlayerId string                 `json:"playerId"`
	Players  map[string]PlayerState `json:"players"`
	World    map[string]string      `json:"world"`
}

type StateCorrectionMessage struct {
	Type string `json:"type"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
}
