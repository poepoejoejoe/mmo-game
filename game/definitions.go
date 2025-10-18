package game

// --- NEW CONSTANTS ---

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
	ServerEventPlayerJoined    ServerEventType = "player_joined"
	ServerEventPlayerLeft      ServerEventType = "player_left"
	ServerEventPlayerMoved     ServerEventType = "player_moved"
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
)

// --- END NEW CONSTANTS ---

// Recipe defines the ingredients required to craft an item.
type Recipe struct {
	Ingredients map[ItemType]int // A map of resource names to the required amount.
	Yield       int              // How many items are produced.
}

// TileProperties defines the behavioral attributes of a game object.
type TileProperties struct {
	IsCollidable    bool     // Player cannot move into this tile.
	IsGatherable    bool     // Player can gather resources from this.
	IsDestructible  bool     // Player can attack and destroy this.
	IsBuildableOn   bool     // Players can place items on this tile.
	MovementPenalty bool     // Moving into this tile applies a penalty.
	GatherResource  ItemType // The item resource gained when gathered.
	MaxHealth       int      // The starting health of this object.
}

// TileDefs is our master map of all tile definitions.
var TileDefs map[TileType]TileProperties // Use new type

// RecipeDefs is our master map of all crafting recipes.
var RecipeDefs map[ItemType]Recipe // Use new type

// The init() function runs automatically to populate our definition maps.
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
