package game

// --- NEW CONSTANTS ---

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

// ItemType defines the string literals for items and resources.
type ItemType string

const (
	ItemWood       ItemType = "wood"
	ItemRock       ItemType = "rock"
	ItemWoodenWall ItemType = "wooden_wall"
)

// ClientEventType defines incoming WebSocket message types.
type ClientEventType string

const (
	ClientEventMove      ClientEventType = "move"
	ClientEventInteract  ClientEventType = "interact"
	ClientEventCraft     ClientEventType = "craft"
	ClientEventPlaceItem ClientEventType = "place_item"
)

// ServerEventType defines outgoing WebSocket message types.
type ServerEventType string

const (
	ServerEventInitialState    ServerEventType = "initial_state"
	ServerEventStateCorrection ServerEventType = "state_correction"
	ServerEventWorldUpdate     ServerEventType = "world_update"
	ServerEventInventoryUpdate ServerEventType = "inventory_update"
	ServerEventResourceDamaged ServerEventType = "resource_damaged"
	ServerEventEntityJoined    ServerEventType = "entity_joined" // <-- RENAMED
	ServerEventEntityLeft      ServerEventType = "entity_left"   // <-- RENAMED
	ServerEventEntityMoved     ServerEventType = "entity_moved"
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
	Ingredients map[ItemType]int // Use new type
	Yield       int
}

// TileProperties defines the behavioral attributes of a game object.
type TileProperties struct {
	IsCollidable    bool
	IsGatherable    bool
	IsDestructible  bool
	IsBuildableOn   bool
	MovementPenalty bool
	GatherResource  ItemType // Use new type
	MaxHealth       int
}

// TileDefs is our master map of all tile definitions.
var TileDefs map[TileType]TileProperties // Use new type

// RecipeDefs is our master map of all crafting recipes.
var RecipeDefs map[ItemType]Recipe // Use new type

func init() {
	TileDefs = make(map[TileType]TileProperties)
	RecipeDefs = make(map[ItemType]Recipe)

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
		GatherResource: ItemRock,
		MaxHealth:      4,
	}
	TileDefs[TileTypeWoodenWall] = TileProperties{
		IsCollidable:   true,
		IsDestructible: true,
		MaxHealth:      10,
	}

	// --- Recipe Definitions (USING CONSTANTS) ---
	RecipeDefs[ItemWoodenWall] = Recipe{
		Ingredients: map[ItemType]int{ItemWood: 10},
		Yield:       1,
	}
}
