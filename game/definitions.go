package game

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
	TileTypeGround     TileType = "ground"
	TileTypeWater      TileType = "water"
	TileTypeTree       TileType = "tree"
	TileTypeRock       TileType = "rock"
	TileTypeWoodenWall TileType = "wooden_wall"
	TileTypeFire       TileType = "fire"
)

// ItemID defines the unique identifier for an item.
type ItemID string

const (
	ItemWood          ItemID = "wood"
	ItemStone         ItemID = "stone" // Renamed from ItemRock for consistency
	ItemWoodenWall    ItemID = "wooden_wall"
	ItemGoop          ItemID = "goop"
	ItemRatMeat       ItemID = "rat_meat"
	ItemCookedRatMeat ItemID = "cooked_rat_meat"
	ItemSliceOfPizza  ItemID = "slice_of_pizza"
	ItemTreasureMap   ItemID = "treasure_map"
	ItemFire          ItemID = "fire"
	ItemCrudeAxe      ItemID = "crude_axe"
)

// ItemProperties defines the static properties of an item type.
type ItemProperties struct {
	Stackable  bool
	MaxStack   int
	Equippable *EquippableProperties
}

// EquippableProperties defines properties for items that can be equipped.
type EquippableProperties struct {
	Slot   string // e.g., "weapon", "shield", "head"
	Damage int    // Bonus damage
}

// ClientEventType defines incoming WebSocket message types.
type ClientEventType string

const (
	ClientEventMove      ClientEventType = "move"
	ClientEventInteract  ClientEventType = "interact"
	ClientEventCraft     ClientEventType = "craft"
	ClientEventPlaceItem ClientEventType = "place_item"
	ClientEventAttack    ClientEventType = "attack"
	ClientEventEat       ClientEventType = "eat"
	ClientEventEquip     ClientEventType = "equip"
	ClientEventUnequip   ClientEventType = "unequip"
)

// ServerEventType defines outgoing WebSocket message types.
type ServerEventType string

const (
	ServerEventInitialState      ServerEventType = "initial_state"
	ServerEventStateCorrection   ServerEventType = "state_correction"
	ServerEventWorldUpdate       ServerEventType = "world_update"
	ServerEventInventoryUpdate   ServerEventType = "inventory_update"
	ServerEventResourceDamaged   ServerEventType = "resource_damaged"
	ServerEventEntityJoined      ServerEventType = "entity_joined" // <-- RENAMED
	ServerEventEntityLeft        ServerEventType = "entity_left"   // <-- RENAMED
	ServerEventEntityMoved       ServerEventType = "entity_moved"
	ServerEventEntityDamaged     ServerEventType = "entity_damaged"
	ServerEventPlayerStatsUpdate ServerEventType = "player_stats_update"
	ServerEventItemDropped       ServerEventType = "item_dropped"
	ServerEventGearUpdate        ServerEventType = "gear_update"
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
	RedisKeyPlayerPrefix    RedisKey = "player:"
	RedisKeyPlayerInventory RedisKey = "player:inventory:"
	RedisKeyPlayerGear      RedisKey = "player:gear:"
	RedisKeyLockTile        RedisKey = "lock:tile:"
	RedisKeyWorldZone0      RedisKey = "world:zone:0"
	RedisKeyZone0Positions  RedisKey = "zone:0:positions"
	RedisKeyLockWorldObject RedisKey = "world_object"
	NPCSlimePrefix          RedisKey = "npc:slime:" // <-- NEW
	NPCRatPrefix            RedisKey = "npc:rat:"   // <-- NEW
	ItemPrefix              RedisKey = "item:"
)

// --- END NEW CONSTANTS ---

// Recipe defines the ingredients required to craft an item.
type Recipe struct {
	Ingredients map[ItemID]int // Use new type
	Yield       int
}

// TileProperties defines the behavioral attributes of a game object.
type TileProperties struct {
	IsCollidable    bool
	IsGatherable    bool
	IsDestructible  bool
	IsBuildableOn   bool
	MovementPenalty bool
	GatherResource  ItemID // Use new type
	MaxHealth       int
	Damage          int
	DamageInterval  int64
	Duration        int64
}

// --- NEW ---
// NPCType defines the string literals for NPC types.
type NPCType string

const (
	NPCTypeSlime NPCType = "slime"
	NPCTypeRat   NPCType = "rat"
)

// NPCProperties defines the behavioral attributes of an NPC.
type NPCProperties struct {
	Health int
	Damage int
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
	// --- END NEW ---

	// --- NPC Definitions ---
	NPCDefs[NPCTypeSlime] = NPCProperties{
		Health: 3,
		Damage: 1,
	}
	NPCDefs[NPCTypeRat] = NPCProperties{
		Health: 2,
		Damage: 2,
	}
	// --- END NEW ---

	NPCLootTables[NPCTypeSlime] = LootTable{
		{ItemID: ItemGoop, Chance: 0.8, Min: 1, Max: 2},
		{ItemID: ItemTreasureMap, Chance: 0.05, Min: 1, Max: 1},
	}
	NPCLootTables[NPCTypeRat] = LootTable{
		{ItemID: ItemRatMeat, Chance: 0.8, Min: 1, Max: 1},
		{ItemID: ItemSliceOfPizza, Chance: 0.1, Min: 1, Max: 1},
		{ItemID: ItemTreasureMap, Chance: 0.05, Min: 1, Max: 1},
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
		MaxHealth:      2,
	}
	TileDefs[TileTypeRock] = TileProperties{
		IsCollidable:   true,
		IsGatherable:   true,
		GatherResource: ItemStone, // Changed from ItemRock
		MaxHealth:      4,
	}
	TileDefs[TileTypeWoodenWall] = TileProperties{
		IsCollidable:   true,
		IsDestructible: true,
		MaxHealth:      10,
	}
	TileDefs[TileTypeFire] = TileProperties{
		IsCollidable:   false,
		IsBuildableOn:  false,
		Damage:         1,
		DamageInterval: 1000,   // 1 second
		Duration:       120000, // 2 minutes
	}

	// --- Recipe Definitions (USING CONSTANTS) ---
	RecipeDefs[ItemWoodenWall] = Recipe{
		Ingredients: map[ItemID]int{ItemWood: 10},
		Yield:       1,
	}
	RecipeDefs[ItemFire] = Recipe{
		Ingredients: map[ItemID]int{ItemWood: 10},
		Yield:       1,
	}
	RecipeDefs[ItemCookedRatMeat] = Recipe{
		Ingredients: map[ItemID]int{ItemRatMeat: 1},
		Yield:       1,
	}
	RecipeDefs[ItemCrudeAxe] = Recipe{
		Ingredients: map[ItemID]int{
			ItemStone: 10,
			ItemWood:  10,
			ItemGoop:  5,
		},
		Yield: 1,
	}

	// --- Edible Definitions ---
	EdibleDefs[ItemCookedRatMeat] = EdibleProperties{
		HealAmount: 2,
	}
	EdibleDefs[ItemSliceOfPizza] = EdibleProperties{
		HealAmount: 5,
	}
}
