package game

// --- NEW STRUCT ---
// Recipe defines the ingredients required to craft an item.
type Recipe struct {
	Ingredients map[string]int // A map of resource names to the required amount.
	Yield       int            // How many items are produced.
}

// TileProperties defines the behavioral attributes of a game object.
type TileProperties struct {
	IsCollidable    bool   // Player cannot move into this tile.
	IsGatherable    bool   // Player can gather resources from this.
	IsDestructible  bool   // Player can attack and destroy this.
	IsBuildableOn   bool   // Players can place items on this tile.
	MovementPenalty bool   // Moving into this tile applies a penalty.
	GatherResource  string // The item resource gained when gathered.
	MaxHealth       int    // The starting health of this object.
}

// TileDefs is our master map of all tile definitions.
var TileDefs map[string]TileProperties

// --- NEW MAP ---
// RecipeDefs is our master map of all crafting recipes.
var RecipeDefs map[string]Recipe

// The init() function runs automatically to populate our definition maps.
func init() {
	TileDefs = make(map[string]TileProperties)
	RecipeDefs = make(map[string]Recipe) // Initialize the new map

	// --- Tile Definitions ---
	TileDefs["ground"] = TileProperties{
		IsCollidable:  false,
		IsBuildableOn: true,
	}
	TileDefs["water"] = TileProperties{
		IsCollidable:    false,
		MovementPenalty: true,
	}
	TileDefs["tree"] = TileProperties{
		IsCollidable:   true,
		IsGatherable:   true,
		GatherResource: "wood",
		MaxHealth:      2,
	}
	TileDefs["rock"] = TileProperties{
		IsCollidable:   true,
		IsGatherable:   true,
		GatherResource: "rock",
		MaxHealth:      4,
	}
	TileDefs["wooden_wall"] = TileProperties{
		IsCollidable:   true,
		IsDestructible: true,
		MaxHealth:      10,
	}

	// --- NEW: Recipe Definitions ---
	// Define the recipe for a wooden_wall.
	RecipeDefs["wooden_wall"] = Recipe{
		Ingredients: map[string]int{"wood": 10},
		Yield:       1,
	}
}
