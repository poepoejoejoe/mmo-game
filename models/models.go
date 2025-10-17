package models

import (
	"encoding/json"
)

// WebSocketMessage is the generic wrapper for all incoming messages from the client.
// The `Payload` is a raw JSON message that gets unmarshalled later based on the `Type`.
type WebSocketMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// MovePayload defines the structure for a "move" action's data.
type MovePayload struct {
	Direction string `json:"direction"`
}

// InteractPayload defines the structure for an "interact" action's data,
// specifying the coordinates of the tile the player is interacting with.
type InteractPayload struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// PlayerState represents the basic positional data of any player in the world.
type PlayerState struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// InitialStateMessage is the large "welcome" packet sent to a newly connected
// client, containing everything they need to render the world for the first time.
type InitialStateMessage struct {
	Type      string                 `json:"type"`
	PlayerId  string                 `json:"playerId"`
	Players   map[string]PlayerState `json:"players"`
	World     map[string]string      `json:"world"`
	Inventory map[string]string      `json:"inventory"`
}

// StateCorrectionMessage is sent from the server to a single client to forcibly
// update their position. This is used for reconciliation when a client's
// optimistic move is rejected by the server.
type StateCorrectionMessage struct {
	Type string `json:"type"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
}

// WorldUpdateMessage is broadcast to all clients when a tile in the world
// changes state (e.g., a tree is chopped down and becomes a ground tile).
type WorldUpdateMessage struct {
	Type string `json:"type"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
	Tile string `json:"tile"`
}

// InventoryUpdateMessage is sent to a single client when they successfully
// gather a resource, updating their inventory count for that item.
type InventoryUpdateMessage struct {
	Type     string `json:"type"`
	Resource string `json:"resource"`
	Amount   int    `json:"amount"`
}
