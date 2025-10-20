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
)

// TileType defines the string literals for tile types.
type TileType string

const (
	TileTypeGround     TileType = "ground"
	TileTypeWater      TileType = "water"
	TileTypeTree       TileType = "tree"
	TileTypeRock       TileType = "rock"
	TileTypeWoodenWall TileType = "wooden_wall"
)

// ItemID defines the unique identifier for an item.
type ItemID string

const (
	ItemWood       ItemID = "wood"
	ItemStone      ItemID = "stone" // Renamed from ItemRock for consistency
	ItemWoodenWall ItemID = "wooden_wall"
)

// ItemProperties defines the static properties of an item type.
type ItemProperties struct {
	Stackable bool
	MaxStack  int
}

// ClientEventType defines incoming WebSocket message types.
type ClientEventType string

const (
	ClientEventMove      ClientEventType = "move"
	ClientEventInteract  ClientEventType = "interact"
	ClientEventCraft     ClientEventType = "craft"
	ClientEventPlaceItem ClientEventType = "place_item"
	ClientEventAttack    ClientEventType = "attack"
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
	RedisKeyLockTile        RedisKey = "lock:tile:"
	RedisKeyWorldZone0      RedisKey = "world:zone:0"
	RedisKeyZone0Positions  RedisKey = "zone:0:positions"
	RedisKeyLockWorldObject RedisKey = "world_object"
	NPCSlimePrefix          RedisKey = "npc:slime:" // <-- NEW
	NPCRatPrefix            RedisKey = "npc:rat:"   // <-- NEW
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

	// --- Player Definitions ---
	PlayerDefs = PlayerProperties{
		MaxHealth: 10,
	}
	// --- END NEW ---

	// --- NPC Definitions ---
	NPCDefs[NPCTypeSlime] = NPCProperties{
		Health: 3,
	}
	NPCDefs[NPCTypeRat] = NPCProperties{
		Health: 2,
	}
	// --- END NEW ---

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

	// --- Recipe Definitions (USING CONSTANTS) ---
	RecipeDefs[ItemWoodenWall] = Recipe{
		Ingredients: map[ItemID]int{ItemWood: 10},
		Yield:       1,
	}
}
