package game

import "mmo-game/models"

// --- NEW CONSTANTS ---

// KILOMETERS_PER_DEGREE is the approximate number of kilometers in one degree of
// latitude/longitude on Earth. Since we are mapping our 2D grid to Redis's
// spherical geo commands, we use this as a conversion factor for distance.
const (
	KILOMETERS_PER_DEGREE = 111.32
)

// EntityType defines the type of an entity.
type EntityType string

const (
	EntityTypePlayer EntityType = "player"
	EntityTypeNPC    EntityType = "npc" // <-- NEW
	EntityTypeItem   EntityType = "item"
)

// TileType defines the string literals for tile types.
type TileType string

const (
	TileTypeGround         TileType = "ground"
	TileTypeWater          TileType = "water"
	TileTypeTree           TileType = "tree"
	TileTypeRock           TileType = "rock"
	TileTypeIronRock       TileType = "iron_rock"
	TileTypeWoodenWall     TileType = "wooden_wall"
	TileTypeFire           TileType = "fire"
	TileTypeSanctuaryStone TileType = "sanctuary_stone"
)

// ItemID defines the unique identifier for an item.
type ItemID string

const (
	ItemWood             ItemID = "wood"
	ItemStone            ItemID = "stone" // Renamed from ItemRock for consistency
	ItemIronOre          ItemID = "iron_ore"
	ItemIronHelmet       ItemID = "iron_helmet"
	ItemRecipeIronHelmet ItemID = "recipe_iron_helmet"
	ItemWoodenWall       ItemID = "wooden_wall"
	ItemGoop             ItemID = "goop"
	ItemRatMeat          ItemID = "rat_meat"
	ItemCookedRatMeat    ItemID = "cooked_rat_meat"
	ItemSliceOfPizza     ItemID = "slice_of_pizza"
	ItemTreasureMap      ItemID = "treasure_map"
	ItemFire             ItemID = "fire"
	ItemCrudeAxe         ItemID = "crude_axe"
)

// RuneType defines the string literals for runes.
type RuneType string

const (
	RuneTypeChopTrees RuneType = "chop_trees"
	RuneTypeMineOre   RuneType = "mine_ore"
)

type ItemKind string

const (
	ItemKindNormal ItemKind = "normal"
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

// ClientEventType defines incoming WebSocket message types.
type ClientEventType string

const (
	ClientEventMove         ClientEventType = "move"
	ClientEventInteract     ClientEventType = "interact"
	ClientEventEquip        ClientEventType = "equip"
	ClientEventUnequip      ClientEventType = "unequip"
	ClientEventCraft        ClientEventType = "craft"
	ClientEventPlaceItem    ClientEventType = "place_item"
	ClientEventAttack       ClientEventType = "attack"
	ClientEventEat          ClientEventType = "eat"
	ClientEventLearnRecipe  ClientEventType = "learn_recipe"
	ClientEventSendChat     ClientEventType = "send_chat"
	ClientEventLogin        ClientEventType = "login"
	ClientEventRegister     ClientEventType = "register"
	ClientEventDialogAction ClientEventType = "dialog_action"
	ClientEventToggleEcho   ClientEventType = "toggle_echo"
	ClientEventSetRune      ClientEventType = "set_rune"
	ClientEventTeleport     ClientEventType = "teleport"
	ClientEventFindPath     ClientEventType = "find-path"
)

// ServerEventType defines outgoing WebSocket message types.
type ServerEventType string

const (
	ServerEventInitialState            ServerEventType = "initial_state"
	ServerEventStateCorrection         ServerEventType = "state_correction"
	ServerEventWorldUpdate             ServerEventType = "world_update"
	ServerEventInventoryUpdate         ServerEventType = "inventory_update"
	ServerEventResourceDamaged         ServerEventType = "resource_damaged"
	ServerEventEntityJoined            ServerEventType = "entity_joined" // <-- RENAMED
	ServerEventEntityLeft              ServerEventType = "entity_left"   // <-- RENAMED
	ServerEventEntityMoved             ServerEventType = "entity_moved"
	ServerEventEntityUpdate            ServerEventType = "entity_update"
	ServerEventEntityDamaged           ServerEventType = "entity_damaged"
	ServerEventPlayerStatsUpdate       ServerEventType = "player_stats_update"
	ServerEventItemDropped             ServerEventType = "item_dropped"
	ServerEventGearUpdate              ServerEventType = "gear_update"
	ServerEventCraftSuccess            ServerEventType = "craft_success"
	ServerEventRecipeLearned           ServerEventType = "recipe_learned"
	ServerEventRegistered              ServerEventType = "registered"
	ServerEventPlayerAppearanceChanged ServerEventType = "player_appearance_changed"
	ServerEventNotification            ServerEventType = "notification"
	ServerEventShowDialog              ServerEventType = "show_dialog"
	ServerEventQuestUpdate             ServerEventType = "quest_update"
	ServerEventNpcQuestStateUpdate     ServerEventType = "npc_quest_state_update"
	ServerEventActiveRuneUpdate        ServerEventType = "active_rune_update"
	ServerEventTeleportChannelStart    ServerEventType = "teleport_channel_start"
	ServerEventTeleportChannelEnd      ServerEventType = "teleport_channel_end"
	ServerEventNoValidPath             ServerEventType = "no-valid-path"
	ServerEventValidPath               ServerEventType = "valid-path"
)

// MoveDirection defines the valid move directions.
type MoveDirection string

const (
	MoveDirectionUp    MoveDirection = "up"
	MoveDirectionDown  MoveDirection = "down"
	MoveDirectionLeft  MoveDirection = "left"
	MoveDirectionRight MoveDirection = "right"
)

// RedisKey defines the prefixes and keys used in Redis.
type RedisKey string

const (
	RedisKeyLockTile          RedisKey = "lock:tile:"
	RedisKeyLockWorldObject   RedisKey = "lock:world"
	RedisKeyPlayerPrefix      RedisKey = "player:"
	RedisKeyPlayerInventory   RedisKey = "inventory:"
	RedisKeyPlayerGear        RedisKey = "gear:"
	RedisKeyZone0Positions    RedisKey = "positions:zone:0"
	RedisKeyResourcePositions RedisKey = "positions:resource"
	RedisKeyWorldZone0        RedisKey = "world:zone:0"
	RedisKeyActiveDecay       RedisKey = "active_decay"
	NPCSlimePrefix            RedisKey = "npc:slime:" // <-- NEW
	NPCBossSlimePrefix        RedisKey = "npc:boss:slime:"
	NPCRatPrefix              RedisKey = "npc:rat:" // <-- NEW
	NPCWizardPrefix           RedisKey = "npc:wizard:"
	ItemPrefix                RedisKey = "item:"
	RedisKeySecretPrefix      RedisKey = "secret:"
	GroupTargetPrefix         RedisKey = "group:target:"
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

// --- NEW ---
// NPCType defines the string literals for NPC types.
type NPCType string

const (
	NPCTypeSlime     NPCType = "slime"
	NPCTypeRat       NPCType = "rat"
	NPCTypeWizard    NPCType = "wizard"
	NPCTypeSlimeBoss NPCType = "slime_boss"
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
