package models

import (
	"encoding/json"
)

type CraftPayload struct {
	Item string `json:"item"`
}

type WorldTile struct {
	Type        string `json:"type"`
	Health      int    `json:"health,omitempty"`
	IsSanctuary bool   `json:"isSanctuary,omitempty"`
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

// EntityState represents the position and type of any entity.
type EntityState struct {
	ID         string          `json:"id,omitempty"`
	X          int             `json:"x"`
	Y          int             `json:"y"`
	Type       string          `json:"type"`
	Direction  string          `json:"direction,omitempty"`
	Name       string          `json:"name,omitempty"`
	QuestState string          `json:"questState,omitempty"`
	ItemID     string          `json:"itemId,omitempty"`
	Owner      string          `json:"owner,omitempty"`
	CreatedAt  int64           `json:"createdAt,omitempty"`
	ShirtColor string          `json:"shirtColor,omitempty"`
	Gear       map[string]Item `json:"gear,omitempty"`
	IsEcho     bool            `json:"isEcho,omitempty"`
}

// InitialStateMessage now sends a map of all entities.
type InitialStateMessage struct {
	Type         string                 `json:"type"`
	PlayerId     string                 `json:"playerId"`
	Entities     map[string]EntityState `json:"entities"`
	World        map[string]WorldTile   `json:"world"`
	Inventory    map[string]Item        `json:"inventory"`
	Gear         map[string]Item        `json:"gear"`
	Bank         map[string]Item        `json:"bank"`
	Quests       map[QuestID]*Quest     `json:"quests"`
	Experience   map[Skill]float64      `json:"experience"`
	Resonance    int64                  `json:"resonance"`
	MaxResonance int64                  `json:"maxResonance"`
	EchoUnlocked bool                   `json:"echoUnlocked"`
	Runes        []string               `json:"runes"`
	ActiveRune   string                 `json:"activeRune"`
	KnownRecipes map[string]bool        `json:"knownRecipes"`
}

type QuestUpdateMessage struct {
	Type   string             `json:"type"`
	Quests map[QuestID]*Quest `json:"quests"`
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

// InventoryUpdateMessage is sent when a player's inventory changes.
type InventoryUpdateMessage struct {
	Type      string          `json:"type"`
	Inventory map[string]Item `json:"inventory"`
}

type BankUpdateMessage struct {
	Type string          `json:"type"`
	Bank map[string]Item `json:"bank"`
}

// GearUpdateMessage is sent when a player's gear changes.
type GearUpdateMessage struct {
	Type string          `json:"type"`
	Gear map[string]Item `json:"gear"`
}

type CraftSuccessMessage struct {
	Type   string `json:"type"`
	ItemID string `json:"itemId"`
}

type PlaceItemPayload struct {
	Item string `json:"item"`
	X    int    `json:"x"`
	Y    int    `json:"y"`
}

type LearnRecipePayload struct {
	InventorySlot string `json:"inventorySlot"`
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
	Type         string            `json:"type"`
	Health       *int              `json:"health,omitempty"`
	MaxHealth    *int              `json:"maxHealth,omitempty"`
	Experience   map[Skill]float64 `json:"experience,omitempty"`
	Resonance    *int64            `json:"resonance,omitempty"`
	MaxResonance *int64            `json:"maxResonance,omitempty"`
	EchoUnlocked *bool             `json:"echoUnlocked,omitempty"`
}

// Item defines a single item instance in a player's inventory.
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
	PlayerId  string `json:"playerId"`
	Name      string `json:"name"`
}

type RecipeLearnedMessage struct {
	Type     string `json:"type"`
	RecipeID string `json:"recipeId"`
}

type NotificationMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type NpcQuestStateUpdateMessage struct {
	Type       string `json:"type"`
	NpcName    string `json:"npcName"`
	QuestState string `json:"questState"`
}

type DialogMessage struct {
	Type    string         `json:"type"`
	NpcName string         `json:"npcName"`
	Text    string         `json:"text"`
	Options []DialogOption `json:"options"`
}

type DialogOption struct {
	Text    string `json:"text"`
	Action  string `json:"action"`
	Context string `json:"context,omitempty"`
}

type DialogActionPayload struct {
	Action  string `json:"action"`
	Context string `json:"context,omitempty"`
}

type QuestID string

const (
	QuestBuildAWall QuestID = "build_a_wall"
	QuestRatProblem QuestID = "rat_problem"
	QuestAngryTrees QuestID = "angry_trees"
)

type Skill string

const (
	SkillWoodcutting  Skill = "woodcutting"
	SkillMining       Skill = "mining"
	SkillSmithing     Skill = "smithing"
	SkillCooking      Skill = "cooking"
	SkillConstruction Skill = "construction"
	SkillAttack       Skill = "attack"
	SkillDefense      Skill = "defense"
)

type ObjectiveType string

const (
	ObjectiveCraft  ObjectiveType = "craft"
	ObjectiveEquip  ObjectiveType = "equip"
	ObjectiveSlay   ObjectiveType = "slay"
	ObjectiveGather ObjectiveType = "gather"
	ObjectivePlace  ObjectiveType = "place"
	ObjectiveCook   ObjectiveType = "cook"
)

type QuestObjective struct {
	Type          ObjectiveType `json:"type"`
	Target        string        `json:"target"`
	RequiredCount int           `json:"requiredCount,omitempty"`
	Count         int           `json:"count,omitempty"`
	Description   string        `json:"description"`
	Completed     bool          `json:"completed"`
}

type Quest struct {
	ID         QuestID          `json:"id"`
	Title      string           `json:"title"`
	Objectives []QuestObjective `json:"objectives"`
	IsComplete bool             `json:"is_complete"`
}

type PlayerQuests struct {
	Quests          map[QuestID]*Quest `json:"quests"`
	CompletedQuests map[QuestID]bool   `json:"completed_quests"`
}

type SetRunePayload struct {
	Rune string `json:"rune"`
}

type FindPathPayload struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type ValidPathPayload struct {
	Directions []string `json:"directions"`
}

type ValidPathMessage struct {
	Type       string   `json:"type"`
	Directions []string `json:"directions"`
}

type TeleportPayload struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type DepositItemPayload struct {
	Slot     string `json:"slot"`
	Quantity int    `json:"quantity"`
}

type WithdrawItemPayload struct {
	Slot     string `json:"slot"`
	Quantity int    `json:"quantity"`
}
