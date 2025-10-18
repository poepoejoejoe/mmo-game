package models

import (
	"encoding/json"
)

type CraftPayload struct {
	Item string `json:"item"`
}

type WorldTile struct {
	Type   string `json:"type"`
	Health int    `json:"health"`
}

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

// --- RENAMED ---
// EntityState represents the position of any entity in the world.
type EntityState struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// --- UPDATED ---
// InitialStateMessage now sends a map of all entities.
type InitialStateMessage struct {
	Type      string                 `json:"type"`
	PlayerId  string                 `json:"playerId"`
	Entities  map[string]EntityState `json:"entities"` // <-- RENAMED
	World     map[string]WorldTile   `json:"world"`
	Inventory map[string]string      `json:"inventory"`
}

type StateCorrectionMessage struct {
	Type string `json:"type"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
}

type WorldUpdateMessage struct {
	Type string    `json:"type"`
	X    int       `json:"x"`
	Y    int       `json:"y"`
	Tile WorldTile `json:"tile"`
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
