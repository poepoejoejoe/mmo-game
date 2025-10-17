package models

import (
	"encoding/json"
)

type CraftPayload struct {
	Item string `json:"item"`
}

// --- NEW ---
// WorldTile represents the complete state of a single tile in the world.
type WorldTile struct {
	Type   string `json:"type"`
	Health int    `json:"health"`
}

// --- NEW ---
// ResourceDamagedMessage is broadcast to all clients when a resource takes damage.
type ResourceDamagedMessage struct {
	Type      string `json:"type"`
	X         int    `json:"x"`
	Y         int    `json:"y"`
	NewHealth int    `json:"newHealth"`
}

type WebSocketMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type MovePayload struct {
	Direction string `json:"direction"`
}

type InteractPayload struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type PlayerState struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// --- UPDATED ---
// InitialStateMessage.World now sends the more complex WorldTile objects.
type InitialStateMessage struct {
	Type      string                 `json:"type"`
	PlayerId  string                 `json:"playerId"`
	Players   map[string]PlayerState `json:"players"`
	World     map[string]WorldTile   `json:"world"`
	Inventory map[string]string      `json:"inventory"`
}

type StateCorrectionMessage struct {
	Type string `json:"type"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
}

type WorldUpdateMessage struct {
	Type string `json:"type"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
	Tile string `json:"tile"`
}

type InventoryUpdateMessage struct {
	Type     string `json:"type"`
	Resource string `json:"resource"`
	Amount   int    `json:"amount"`
}

type PlaceItemPayload struct {
	Item string `json:"item"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
}
