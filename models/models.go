package models

import (
	"encoding/json"
)

type CraftPayload struct {
	Item string `json:"item"`
}

type WorldTile struct {
	Type   string `json:"type"`
	Health int    `json:"health,omitempty"`
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
	X        int    `json:"x"`
	Y        int    `json:"y"`
	EntityID string `json:"entityId,omitempty"`
}

// --- UPDATED ---
// EntityState represents the position and type of any entity.
type EntityState struct {
	ID         string `json:"id,omitempty"`
	X          int    `json:"x"`
	Y          int    `json:"y"`
	Type       string `json:"type"`
	Direction  string `json:"direction,omitempty"`
	Name       string `json:"name,omitempty"`
	ItemID     string `json:"itemId,omitempty"`
	Owner      string `json:"owner,omitempty"`
	CreatedAt  int64  `json:"createdAt,omitempty"`
	ShirtColor string `json:"shirtColor,omitempty"`
}

// InitialStateMessage now sends a map of all entities.
type InitialStateMessage struct {
	Type      string                 `json:"type"`
	PlayerId  string                 `json:"playerId"`
	Entities  map[string]EntityState `json:"entities"`
	World     map[string]WorldTile   `json:"world"`
	Inventory map[string]Item        `json:"inventory"`
	Gear      map[string]Item        `json:"gear"`
}

// (Other models remain the same)
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

// InventoryUpdateMessage is sent when a player's inventory changes.
// It sends the entire new inventory state.
type InventoryUpdateMessage struct {
	Type      string          `json:"type"`
	Inventory map[string]Item `json:"inventory"`
}

// GearUpdateMessage is sent when a player's gear changes.
type GearUpdateMessage struct {
	Type string          `json:"type"`
	Gear map[string]Item `json:"gear"`
}

type PlaceItemPayload struct {
	Item string `json:"item"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
}

type AttackPayload struct {
	EntityID string `json:"entityId"`
}

type EatPayload struct {
	Item string `json:"item"`
}

type EquipPayload struct {
	InventorySlot string `json:"inventorySlot"`
}

type UnequipPayload struct {
	GearSlot string `json:"gearSlot"`
}

type EntityDamagedMessage struct {
	Type     string `json:"type"`
	EntityID string `json:"entityId"`
	Damage   int    `json:"damage"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
}

type PlayerStatsUpdateMessage struct {
	Type      string `json:"type"`
	Health    int    `json:"health"`
	MaxHealth int    `json:"maxHealth"`
}

// Item defines a single item instance in a player's inventory.
// This is being moved from the 'game' package to here.
type Item struct {
	ID       string `json:"id"`
	Quantity int    `json:"quantity"`
}

type SendChatMessage struct {
	Message string `json:"message"`
}

type PlayerChatMessage struct {
	Type     string `json:"type"`
	PlayerID string `json:"playerId"`
	Message  string `json:"message"`
}

type LoginPayload struct {
	SecretKey string `json:"secretKey"`
}

type RegisterPayload struct {
	Name string `json:"name"`
}

type RegisteredMessage struct {
	Type      string `json:"type"`
	SecretKey string `json:"secretKey"`
	PlayerID  string `json:"playerId"`
	Name      string `json:"name"`
}
