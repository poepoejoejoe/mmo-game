package game

import "mmo-game/models"

// --- NEW CONSTANTS ---

// KILOMETERS_PER_DEGREE is the approximate number of kilometers in one degree of
// latitude/longitude on Earth. Since we are mapping our 2D grid to Redis's
// spherical geo commands, we use this as a conversion factor for distance.
const (
	KILOMETERS_PER_DEGREE = 111.32
)

// Game configuration constants
const (
	// InventorySize is the number of slots in a player's inventory.
	InventorySize = 10
	
	// BankSize is the number of slots in a player's bank.
	BankSize = 64
	
	// ChatRadius is the maximum distance (in tiles) that chat messages can be heard.
	ChatRadius = 10
	
	// MaxChatMessageLength is the maximum length of a chat message in characters.
	MaxChatMessageLength = 100
	
	// SlotKeyPrefix is the prefix used for slot keys (e.g., "slot_0", "slot_1").
	SlotKeyPrefix = "slot_"
	
	// MinSlotKeyLength is the minimum length of a valid slot key.
	// Slot keys are formatted as "slot_" + number, so minimum is "slot_0" (6 chars).
	MinSlotKeyLength = len(SlotKeyPrefix) + 1
)

// EntityType defines the type of an entity in the game world.
// Entities can be players, NPCs, or items. This type is used to distinguish
// between different entity types when processing game logic.
type EntityType string

const (
	// EntityTypePlayer represents a player-controlled character.
	EntityTypePlayer EntityType = "player"
	
	// EntityTypeNPC represents a non-player character (enemy, friendly NPC, etc.).
	EntityTypeNPC EntityType = "npc"
	
	// EntityTypeItem represents an item that can be picked up from the world.
	EntityTypeItem EntityType = "item"
)

// TileType defines the types of tiles that can exist in the game world.
// Tiles represent the terrain and objects that make up the game map.
// Each tile type has associated properties defined in TileDefs.
type TileType string

const (
	// TileTypeGround is the default walkable terrain tile.
	TileTypeGround TileType = "ground"
	
	// TileTypeWater is a water tile that slows movement but is walkable.
	TileTypeWater TileType = "water"
	
	// TileTypeTree is a gatherable resource tile that yields wood when harvested.
	TileTypeTree TileType = "tree"
	
	// TileTypeRock is a gatherable resource tile that yields stone when mined.
	TileTypeRock TileType = "rock"
	
	// TileTypeIronRock is a gatherable resource tile that yields iron ore when mined.
	TileTypeIronRock TileType = "iron_rock"
	
	// TileTypeWoodenWall is a player-built structure that blocks movement and can decay.
	TileTypeWoodenWall TileType = "wooden_wall"
	
	// TileTypeFire is a temporary tile that damages entities and expires after a duration.
	TileTypeFire TileType = "fire"
	
	// TileTypeSanctuaryStone is a permanent structure that marks a sanctuary zone.
	// Players can bind to sanctuary stones for respawn and teleportation.
	TileTypeSanctuaryStone TileType = "sanctuary_stone"
)

// ItemID defines the unique identifier for an item type in the game.
// ItemIDs are used throughout the codebase to reference items consistently.
// Each item has properties defined in ItemDefs.
type ItemID string

const (
	// ItemWood is a basic resource gathered from trees.
	ItemWood ItemID = "wood"
	
	// ItemStone is a basic resource gathered from rocks.
	ItemStone ItemID = "stone"
	
	// ItemIronOre is a resource gathered from iron rocks, used for crafting.
	ItemIronOre ItemID = "iron_ore"
	
	// ItemIronHelmet is a crafted equippable item that provides defense.
	ItemIronHelmet ItemID = "iron_helmet"
	
	// ItemRecipeIronHelmet is a recipe item that teaches how to craft an iron helmet.
	ItemRecipeIronHelmet ItemID = "recipe_iron_helmet"
	
	// ItemWoodenWall is a placeable item that creates a wooden wall tile.
	ItemWoodenWall ItemID = "wooden_wall"
	
	// ItemGoop is a loot item dropped by slimes.
	ItemGoop ItemID = "goop"
	
	// ItemRatMeat is a raw food item dropped by rats.
	ItemRatMeat ItemID = "rat_meat"
	
	// ItemCookedRatMeat is a cooked food item that restores health when eaten.
	ItemCookedRatMeat ItemID = "cooked_rat_meat"
	
	// ItemSliceOfPizza is a rare food item that restores significant health.
	ItemSliceOfPizza ItemID = "slice_of_pizza"
	
	// ItemTreasureMap is a special item used for quests or future features.
	ItemTreasureMap ItemID = "treasure_map"
	
	// ItemFire is a placeable item that creates a fire tile.
	ItemFire ItemID = "fire"
	
	// ItemCrudeAxe is a crafted equippable weapon that increases attack damage.
	ItemCrudeAxe ItemID = "crude_axe"
)

// RuneType defines the types of runes that can be equipped to control echo behavior.
// Runes determine what actions an echo (AI-controlled player) will perform.
type RuneType string

const (
	// RuneTypeChopTrees causes the echo to automatically chop nearby trees.
	RuneTypeChopTrees RuneType = "chop_trees"
	
	// RuneTypeMineOre causes the echo to automatically mine nearby ore deposits.
	RuneTypeMineOre RuneType = "mine_ore"
)

// ItemKind categorizes items into different types for special handling.
type ItemKind string

const (
	// ItemKindNormal represents a standard item with no special properties.
	ItemKindNormal ItemKind = "normal"
	
	// ItemKindRecipe represents an item that teaches a crafting recipe when used.
	ItemKindRecipe ItemKind = "recipe"
)

// ItemProperties defines the static properties of an item type.
type ItemProperties struct {
	Stackable  bool
	MaxStack   int
	Equippable *EquippableProperties
	Kind       ItemKind
	RecipeID   ItemID
}

// EquippableProperties defines properties for items that can be equipped.
type EquippableProperties struct {
	Slot    string // e.g., "weapon", "shield", "head"
	Damage  int    // Bonus damage
	Defense int    // Bonus defense
}

// ClientEventType defines incoming WebSocket message types sent from clients.
// These are the action types that players can trigger. Each event type should
// have a corresponding handler registered in the ActionRegistry.
type ClientEventType string

const (
	// ClientEventMove is sent when a player wants to move in a direction.
	ClientEventMove ClientEventType = "move"
	
	// ClientEventInteract is sent when a player interacts with a tile or entity.
	ClientEventInteract ClientEventType = "interact"
	
	// ClientEventEquip is sent when a player equips an item from inventory.
	ClientEventEquip ClientEventType = "equip"
	
	// ClientEventUnequip is sent when a player unequips an item.
	ClientEventUnequip ClientEventType = "unequip"
	
	// ClientEventCraft is sent when a player wants to craft an item.
	ClientEventCraft ClientEventType = "craft"
	
	// ClientEventPlaceItem is sent when a player places an item in the world.
	ClientEventPlaceItem ClientEventType = "place_item"
	
	// ClientEventAttack is sent when a player attacks an entity.
	ClientEventAttack ClientEventType = "attack"
	
	// ClientEventEat is sent when a player consumes a food item.
	ClientEventEat ClientEventType = "eat"
	
	// ClientEventLearnRecipe is sent when a player uses a recipe item.
	ClientEventLearnRecipe ClientEventType = "learn_recipe"
	
	// ClientEventSendChat is sent when a player sends a chat message.
	ClientEventSendChat ClientEventType = "send_chat"
	
	// ClientEventLogin is sent when a player first connects (authentication).
	ClientEventLogin ClientEventType = "login"
	
	// ClientEventRegister is sent when a player creates an account.
	ClientEventRegister ClientEventType = "register"
	
	// ClientEventDialogAction is sent when a player selects a dialog option.
	ClientEventDialogAction ClientEventType = "dialog_action"
	
	// ClientEventToggleEcho is sent when a player toggles echo mode on/off.
	ClientEventToggleEcho ClientEventType = "toggle_echo"
	
	// ClientEventSetRune is sent when a player sets their active rune.
	ClientEventSetRune ClientEventType = "set_rune"
	
	// ClientEventTeleport is sent when a player initiates a teleport.
	ClientEventTeleport ClientEventType = "teleport"
	
	// ClientEventFindPath is sent when a player requests pathfinding.
	ClientEventFindPath ClientEventType = "find-path"
	
	// ClientEventDepositItem is sent when a player deposits an item in the bank.
	ClientEventDepositItem ClientEventType = "deposit_item"
	
	// ClientEventWithdrawItem is sent when a player withdraws an item from the bank.
	ClientEventWithdrawItem ClientEventType = "withdraw_item"
	
	// ClientEventReorderItem is sent when a player reorders items in inventory or bank.
	ClientEventReorderItem ClientEventType = "reorder_item"
)

// ServerEventType defines outgoing WebSocket message types sent to clients.
// These are the update types that the server broadcasts or sends to players.
// Each event type corresponds to a message structure in the models package.
type ServerEventType string

const (
	// ServerEventInitialState is sent when a player first connects, containing their full game state.
	ServerEventInitialState ServerEventType = "initial_state"
	
	// ServerEventStateCorrection is sent when a client's state needs to be corrected (e.g., invalid move).
	ServerEventStateCorrection ServerEventType = "state_correction"
	
	// ServerEventWorldUpdate is broadcast when a tile in the world changes.
	ServerEventWorldUpdate ServerEventType = "world_update"
	
	// ServerEventInventoryUpdate is sent to a player when their inventory changes.
	ServerEventInventoryUpdate ServerEventType = "inventory_update"
	
	// ServerEventBankUpdate is sent to a player when their bank contents change.
	ServerEventBankUpdate ServerEventType = "bank_update"
	
	// ServerEventResourceDamaged is broadcast when a resource tile takes damage.
	ServerEventResourceDamaged ServerEventType = "resource_damaged"
	
	// ServerEventEntityJoined is broadcast when a new entity (player, NPC, item) appears in the world.
	ServerEventEntityJoined ServerEventType = "entity_joined"
	
	// ServerEventEntityLeft is broadcast when an entity leaves the world.
	ServerEventEntityLeft ServerEventType = "entity_left"
	
	// ServerEventEntityMoved is broadcast when an entity moves to a new position.
	ServerEventEntityMoved ServerEventType = "entity_moved"
	
	// ServerEventEntityUpdate is broadcast when an entity's properties change.
	ServerEventEntityUpdate ServerEventType = "entity_update"
	
	// ServerEventEntityDamaged is broadcast when an entity takes damage.
	ServerEventEntityDamaged ServerEventType = "entity_damaged"
	
	// ServerEventPlayerStatsUpdate is sent to a player when their stats (health, etc.) change.
	ServerEventPlayerStatsUpdate ServerEventType = "player_stats_update"
	
	// ServerEventItemDropped is broadcast when an item is dropped in the world.
	ServerEventItemDropped ServerEventType = "item_dropped"
	
	// ServerEventGearUpdate is sent to a player when their equipped gear changes.
	ServerEventGearUpdate ServerEventType = "gear_update"
	
	// ServerEventCraftSuccess is sent to a player when they successfully craft an item.
	ServerEventCraftSuccess ServerEventType = "craft_success"
	
	// ServerEventRecipeLearned is sent to a player when they learn a new recipe.
	ServerEventRecipeLearned ServerEventType = "recipe_learned"
	
	// ServerEventRegistered is sent to a player when they successfully register an account.
	ServerEventRegistered ServerEventType = "registered"
	
	// ServerEventPlayerAppearanceChanged is broadcast when a player's appearance (gear) changes.
	ServerEventPlayerAppearanceChanged ServerEventType = "player_appearance_changed"
	
	// ServerEventNotification is sent to a player to display a notification message.
	ServerEventNotification ServerEventType = "notification"
	
	// ServerEventShowDialog is sent to a player to display an NPC dialog.
	ServerEventShowDialog ServerEventType = "show_dialog"
	
	// ServerEventQuestUpdate is sent to a player when their quest progress changes.
	ServerEventQuestUpdate ServerEventType = "quest_update"
	
	// ServerEventNpcQuestStateUpdate is broadcast when an NPC's quest-related state changes.
	ServerEventNpcQuestStateUpdate ServerEventType = "npc_quest_state_update"
	
	// ServerEventActiveRuneUpdate is sent to a player when their active rune changes.
	ServerEventActiveRuneUpdate ServerEventType = "active_rune_update"
	
	// ServerEventTeleportChannelStart is sent to a player when they begin channeling a teleport.
	ServerEventTeleportChannelStart ServerEventType = "teleport_channel_start"
	
	// ServerEventTeleportChannelEnd is sent to a player when teleport channeling ends or is interrupted.
	ServerEventTeleportChannelEnd ServerEventType = "teleport_channel_end"
	
	// ServerEventNoValidPath is sent to a player when pathfinding finds no valid path.
	ServerEventNoValidPath ServerEventType = "no-valid-path"
	
	// ServerEventValidPath is sent to a player when pathfinding finds a valid path.
	ServerEventValidPath ServerEventType = "valid-path"
	
	// ServerEventOpenBankWindow is sent to a player to open the bank interface.
	ServerEventOpenBankWindow ServerEventType = "open_bank_window"
)

// MoveDirection defines the valid movement directions for entities.
// Used when processing move actions and updating entity positions.
type MoveDirection string

const (
	// MoveDirectionUp moves the entity one tile up (negative Y).
	MoveDirectionUp MoveDirection = "up"
	
	// MoveDirectionDown moves the entity one tile down (positive Y).
	MoveDirectionDown MoveDirection = "down"
	
	// MoveDirectionLeft moves the entity one tile left (negative X).
	MoveDirectionLeft MoveDirection = "left"
	
	// MoveDirectionRight moves the entity one tile right (positive X).
	MoveDirectionRight MoveDirection = "right"
)

// RedisKey defines the prefixes and keys used in Redis for storing game state.
// These constants ensure consistent key naming across the codebase and prevent
// typos that could lead to data loss or corruption.
type RedisKey string

const (
	// RedisKeyLockTile is the prefix for tile lock keys (format: "lock:tile:x,y").
	// Used to prevent multiple entities from occupying the same tile simultaneously.
	RedisKeyLockTile RedisKey = "lock:tile:"
	
	// RedisKeyLockWorldObject is the value used when locking a tile for world objects.
	RedisKeyLockWorldObject RedisKey = "lock:world"
	
	// RedisKeyPlayerPrefix is the prefix for player entity keys (format: "player:uuid").
	RedisKeyPlayerPrefix RedisKey = "player:"
	
	// RedisKeyPlayerInventory is the prefix for player inventory keys (format: "inventory:player:uuid").
	RedisKeyPlayerInventory RedisKey = "inventory:"
	
	// RedisKeyPlayerGear is the prefix for player gear keys (format: "gear:player:uuid").
	RedisKeyPlayerGear RedisKey = "gear:"
	
	// RedisKeyZone0Positions is the Redis geospatial key for entity positions in zone 0.
	// Used for efficient spatial queries to find entities near a location.
	RedisKeyZone0Positions RedisKey = "positions:zone:0"
	
	// RedisKeyResourcePositions is the Redis geospatial key for resource tile positions.
	// Used for efficient spatial queries to find resources near a location.
	RedisKeyResourcePositions RedisKey = "positions:resource"
	
	// RedisKeyWorldZone0 is the Redis hash key for world tile data in zone 0.
	// Format: "world:zone:0" with field keys like "x,y" containing tile JSON.
	RedisKeyWorldZone0 RedisKey = "world:zone:0"
	
	// RedisKeyActiveDecay is the Redis set key containing coordinates of tiles that are actively decaying.
	// Format: set of "x,y" strings. Used to efficiently find tiles that need decay processing.
	RedisKeyActiveDecay RedisKey = "active_decay"
	
	// NPCSlimePrefix is the prefix for slime NPC entity keys (format: "npc:slime:uuid").
	NPCSlimePrefix RedisKey = "npc:slime:"
	
	// NPCBossSlimePrefix is the prefix for boss slime NPC entity keys (format: "npc:boss:slime:uuid").
	NPCBossSlimePrefix RedisKey = "npc:boss:slime:"
	
	// NPCRatPrefix is the prefix for rat NPC entity keys (format: "npc:rat:uuid").
	NPCRatPrefix RedisKey = "npc:rat:"
	
	// NPCWizardPrefix is the prefix for wizard NPC entity keys (format: "npc:wizard:uuid").
	NPCWizardPrefix RedisKey = "npc:wizard:"
	
	// ItemPrefix is the prefix for item entity keys (format: "item:uuid").
	ItemPrefix RedisKey = "item:"
	
	// RedisKeySecretPrefix is the prefix for secret key lookup (format: "secret:key" -> "player:uuid").
	// Used to map authentication secret keys to player IDs.
	RedisKeySecretPrefix RedisKey = "secret:"
	
	// GroupTargetPrefix is the prefix for group targeting keys (format: "group:target:entityId").
	// Used for tracking which entities are being targeted by groups of players.
	GroupTargetPrefix RedisKey = "group:target:"
)

// --- END NEW CONSTANTS ---

// Recipe defines the ingredients required to craft an item.
type Recipe struct {
	Ingredients   map[ItemID]int // Use new type
	Yield         int
	CraftingSkill models.Skill
	CraftingXP    float64
}

// TileProperties defines the behavioral attributes of a game object.
type TileProperties struct {
	IsCollidable    bool
	IsGatherable    bool
	IsDestructible  bool
	IsBuildableOn   bool
	MovementPenalty bool
	GatherResource  ItemID // Use new type
	GatherSkill     models.Skill
	GatherXP        float64
	MaxHealth       int
	Damage          int
	DamageInterval  int64
	Duration        int64

	// Decay properties
	Decays               bool
	DecayChancePerSecond float64
	DecayAmount          int
}

// NPCType defines the types of NPCs that can exist in the game world.
// Each NPC type has associated properties defined in NPCDefs.
type NPCType string

const (
	// NPCTypeSlime is a basic hostile NPC that attacks players on sight.
	NPCTypeSlime NPCType = "slime"
	
	// NPCTypeRat is a hostile NPC that drops meat and occasionally pizza.
	NPCTypeRat NPCType = "rat"
	
	// NPCTypeWizard is a friendly NPC that provides quests and dialog.
	NPCTypeWizard NPCType = "wizard"
	
	// NPCTypeSlimeBoss is a powerful boss variant of the slime with increased stats.
	NPCTypeSlimeBoss NPCType = "slime_boss"
	
	// NPCTypeGolemBanker is a friendly NPC that provides banking services.
	NPCTypeGolemBanker NPCType = "golem_banker"
)

// NPCProperties defines the behavioral attributes of an NPC.
type NPCProperties struct {
	MaxHealth      int
	Attack         int
	AttackXP       float64
	DefenseXP      float64
	LootTable      LootTable
	IsAggro        bool // Does this NPC attack on sight?
	AggroRange     int  // How far does it see players?
	WanderDistance int
	IsFriendly     bool
}

type LootEntry struct {
	ItemID ItemID
	Chance float64 // 0.0 to 1.0
	Min    int
	Max    int
}

type LootTable []LootEntry

// EdibleProperties defines the properties of a consumable item.
type EdibleProperties struct {
	HealAmount int
}

// PlayerProperties defines the constant attributes of a player.
type PlayerProperties struct {
	MaxHealth int
}

// Sanctuary defines the properties of a sanctuary.
type Sanctuary struct {
	X, Y, Radius int
}

var Sanctuaries []Sanctuary
var ResourceTargets map[TileType]int

var resourceFillPercentage = map[TileType]float64{
	TileTypeTree:     0.9,
	TileTypeRock:     0.65,
	TileTypeIronRock: 0.5,
}

// --- END NEW ---

// TileDefs is our master map of all tile definitions.
var TileDefs map[TileType]TileProperties // Use new type

// --- NEW ---
// NPCDefs is our master map of all NPC definitions.
var NPCDefs map[NPCType]NPCProperties

var NPCLootTables map[NPCType]LootTable

// EdibleDefs is our master map of all edible item definitions.
var EdibleDefs map[ItemID]EdibleProperties

// --- NEW ---
var PlayerDefs PlayerProperties

// --- END NEW ---

// ItemDefs is our master map of all item definitions.
var ItemDefs map[ItemID]ItemProperties

// RecipeDefs is our master map of all crafting recipes.
var RecipeDefs map[ItemID]Recipe // Use new type

func init() {
	TileDefs = make(map[TileType]TileProperties)
	RecipeDefs = make(map[ItemID]Recipe)
	NPCDefs = make(map[NPCType]NPCProperties) // --- NEW ---
	ItemDefs = make(map[ItemID]ItemProperties)
	NPCLootTables = make(map[NPCType]LootTable)
	EdibleDefs = make(map[ItemID]EdibleProperties)

	// --- Player Definitions ---
	PlayerDefs = PlayerProperties{
		MaxHealth: 10,
	}
	Sanctuaries = []Sanctuary{
		{X: 0, Y: 1, Radius: 8}, // Starting sanctuary at origin
	}
	// --- END NEW ---

	// --- NPC Definitions ---
	NPCDefs[NPCTypeSlime] = NPCProperties{
		MaxHealth:      15,
		Attack:         2,
		AttackXP:       15,
		DefenseXP:      10,
		LootTable:      NPCLootTables[NPCTypeSlime],
		IsAggro:        true,
		AggroRange:     4,
		WanderDistance: 3,
	}
	NPCDefs[NPCTypeSlimeBoss] = NPCProperties{
		MaxHealth:      100,
		Attack:         5,
		AttackXP:       100,
		DefenseXP:      50,
		LootTable:      NPCLootTables[NPCTypeSlimeBoss],
		IsAggro:        true,
		AggroRange:     8,
		WanderDistance: 1,
	}
	NPCDefs[NPCTypeRat] = NPCProperties{
		MaxHealth:      10,
		Attack:         1,
		AttackXP:       10,
		DefenseXP:      5,
		LootTable:      NPCLootTables[NPCTypeRat],
		IsAggro:        true,
		AggroRange:     5,
		WanderDistance: 5,
	}
	NPCDefs[NPCTypeWizard] = NPCProperties{
		MaxHealth:      100,
		Attack:         0,
		WanderDistance: 0,
		IsFriendly:     true,
	}
	NPCDefs[NPCTypeGolemBanker] = NPCProperties{
		MaxHealth:      999,
		Attack:         0,
		WanderDistance: 0,
		IsFriendly:     true,
	}
	// --- END NEW ---

	NPCLootTables[NPCTypeSlime] = LootTable{
		{ItemID: ItemGoop, Chance: 0.8, Min: 1, Max: 2},
	}
	NPCLootTables[NPCTypeSlimeBoss] = LootTable{
		{ItemID: ItemGoop, Chance: 1.0, Min: 3, Max: 5},
		{ItemID: ItemRecipeIronHelmet, Chance: 0.5, Min: 1, Max: 1},
	}
	NPCLootTables[NPCTypeRat] = LootTable{
		{ItemID: ItemRatMeat, Chance: 0.8, Min: 1, Max: 1},
		{ItemID: ItemSliceOfPizza, Chance: 0.1, Min: 1, Max: 1},
	}

	// --- Item Definitions ---
	ItemDefs[ItemWood] = ItemProperties{
		Stackable: true,
		MaxStack:  200, // Example max stack
	}
	ItemDefs[ItemStone] = ItemProperties{
		Stackable: true,
		MaxStack:  100, // Example max stack
	}
	ItemDefs[ItemWoodenWall] = ItemProperties{
		Stackable: true,
		MaxStack:  50,
	}
	ItemDefs[ItemGoop] = ItemProperties{
		Stackable: true,
		MaxStack:  50,
	}
	ItemDefs[ItemIronOre] = ItemProperties{
		Stackable: true,
		MaxStack:  50,
	}
	ItemDefs[ItemRecipeIronHelmet] = ItemProperties{
		Stackable: false,
		MaxStack:  1,
		Kind:      ItemKindRecipe,
		RecipeID:  ItemIronHelmet,
	}
	ItemDefs[ItemIronHelmet] = ItemProperties{
		Stackable: false,
		MaxStack:  1,
		Equippable: &EquippableProperties{
			Slot:    "head-slot",
			Defense: 1,
		},
	}
	ItemDefs[ItemRatMeat] = ItemProperties{
		Stackable: true,
		MaxStack:  50,
	}
	ItemDefs[ItemCookedRatMeat] = ItemProperties{
		Stackable: true,
		MaxStack:  50,
	}
	ItemDefs[ItemSliceOfPizza] = ItemProperties{
		Stackable: true,
		MaxStack:  10,
	}
	ItemDefs[ItemTreasureMap] = ItemProperties{
		Stackable: false,
		MaxStack:  1,
	}
	ItemDefs[ItemFire] = ItemProperties{
		Stackable: true,
		MaxStack:  10,
	}
	ItemDefs[ItemCrudeAxe] = ItemProperties{
		Stackable: false,
		MaxStack:  1,
		Equippable: &EquippableProperties{
			Slot:   "weapon-slot",
			Damage: 2,
		},
	}

	// --- Tile Definitions (USING CONSTANTS) ---
	TileDefs[TileTypeGround] = TileProperties{
		IsCollidable:  false,
		IsBuildableOn: true,
	}
	TileDefs[TileTypeWater] = TileProperties{
		IsCollidable:    false,
		MovementPenalty: true,
	}
	TileDefs[TileTypeTree] = TileProperties{
		IsCollidable:   true,
		IsGatherable:   true,
		GatherResource: ItemWood,
		GatherSkill:    models.SkillWoodcutting,
		GatherXP:       10,
		MaxHealth:      2,
	}
	TileDefs[TileTypeRock] = TileProperties{
		IsCollidable:   true,
		IsGatherable:   true,
		GatherResource: ItemStone, // Changed from ItemRock
		GatherSkill:    models.SkillMining,
		GatherXP:       10,
		MaxHealth:      4,
	}
	TileDefs[TileTypeIronRock] = TileProperties{
		IsCollidable:   true,
		IsGatherable:   true,
		GatherResource: ItemIronOre,
		GatherSkill:    models.SkillMining,
		GatherXP:       20,
		MaxHealth:      8,
	}
	TileDefs[TileTypeWoodenWall] = TileProperties{
		IsCollidable:         true,
		IsDestructible:       true,
		MaxHealth:            10,
		Decays:               true,
		DecayChancePerSecond: 1.0 / (90.0 * 60.0 / 10.0), // ~1.5 hour lifetime for 10HP
		DecayAmount:          1,
	}
	TileDefs[TileTypeFire] = TileProperties{
		IsCollidable:   false,
		IsBuildableOn:  false,
		Damage:         1,
		DamageInterval: 1000,   // 1 second
		Duration:       120000, // 2 minutes
	}
	TileDefs[TileTypeSanctuaryStone] = TileProperties{
		IsCollidable:   true,
		IsBuildableOn:  false,
		IsDestructible: false,
	}

	// --- Recipe Definitions (USING CONSTANTS) ---
	RecipeDefs[ItemWoodenWall] = Recipe{
		Ingredients:   map[ItemID]int{ItemWood: 10},
		Yield:         1,
		CraftingSkill: models.SkillConstruction,
		CraftingXP:    5,
	}
	RecipeDefs[ItemFire] = Recipe{
		Ingredients:   map[ItemID]int{ItemWood: 10},
		Yield:         1,
		CraftingSkill: models.SkillConstruction,
		CraftingXP:    10,
	}
	RecipeDefs[ItemIronHelmet] = Recipe{
		Ingredients:   map[ItemID]int{ItemIronOre: 5},
		Yield:         1,
		CraftingSkill: models.SkillSmithing,
		CraftingXP:    50,
	}
	RecipeDefs[ItemCookedRatMeat] = Recipe{
		Ingredients:   map[ItemID]int{ItemRatMeat: 1},
		Yield:         1,
		CraftingSkill: models.SkillCooking,
		CraftingXP:    15,
	}
	RecipeDefs[ItemCrudeAxe] = Recipe{
		Ingredients: map[ItemID]int{
			ItemStone: 10,
			ItemWood:  10,
			ItemGoop:  5,
		},
		Yield:         1,
		CraftingSkill: models.SkillSmithing,
		CraftingXP:    25,
	}

	// --- Edible Definitions ---
	EdibleDefs[ItemCookedRatMeat] = EdibleProperties{
		HealAmount: 2,
	}
	EdibleDefs[ItemSliceOfPizza] = EdibleProperties{
		HealAmount: 5,
	}
}
