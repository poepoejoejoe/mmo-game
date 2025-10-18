package game

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

// The init() function in Go is a special function that runs automatically
// when the package is first used. We use it to populate our definitions map.
func init() {
	TileDefs = make(map[string]TileProperties)

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
}
