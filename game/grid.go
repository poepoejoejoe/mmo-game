package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"

	"github.com/go-redis/redis/v8"
)

// CollisionGrid holds static, read-only world collision data.
// The key is a string concatenation of "x,y" coordinates.
var CollisionGrid map[string]bool

// TickCache holds a snapshot of all dynamic data needed for one AI tick.
type TickCache struct {
	EntityData    map[string]map[string]string
	ResourceNodes map[TileType][]redis.GeoLocation
	LockedTiles   map[string]bool
	CollisionGrid map[string]bool
}

// InitializeCollisionGrid scans the world state from Redis and populates a local,
// in-memory grid of all collidable tiles for fast pathfinding checks.
// This should be called once at server startup.
func InitializeCollisionGrid() {
	CollisionGrid = make(map[string]bool)

	worldData, err := rdb.HGetAll(ctx, string(RedisKeyWorldZone0)).Result()
	if err != nil {
		log.Fatalf("FATAL: Failed to get world data for collision grid: %v", err)
		return
	}

	for coord, tileJSON := range worldData {
		var tile models.WorldTile
		if err := json.Unmarshal([]byte(tileJSON), &tile); err != nil {
			log.Printf("Error unmarshalling tile %s: %v", coord, err)
			continue
		}

		if props, ok := TileDefs[TileType(tile.Type)]; ok {
			if props.IsCollidable {
				CollisionGrid[coord] = true
			}
		}
	}
	log.Printf("Successfully built and cached collision grid with %d collidable tiles.", len(CollisionGrid))
}

// BuildCollisionGrid now simply returns the pre-built, cached grid.
func BuildCollisionGrid() map[string]bool {
	if CollisionGrid == nil {
		log.Println("Warning: Collision grid accessed before initialization.")
		return make(map[string]bool)
	}
	return CollisionGrid
}
