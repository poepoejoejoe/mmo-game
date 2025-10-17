package game

import (
	"time"

	"github.com/go-redis/redis/v8"
)

// These constants define the core rules of the game world and are visible
// to all other files in the 'game' package.
const (
	// Base cooldown for any player action, like interacting or a normal move.
	BaseActionCooldown = 100 * time.Millisecond

	// A specific, longer cooldown applied when moving through water tiles.
	WaterMovePenalty = 500 * time.Millisecond

	// The radius of the procedurally generated world, from the center (0,0).
	WorldSize = 50

	// The number of interactions required to deplete a Tree resource.
	HealthTree = 2

	// The number of interactions required to deplete a Rock resource.
	HealthRock = 4

	// Recipe definition: The amount of wood required to craft one wall.
	WoodPerWall = 10

	// The number of health points a newly placed wall has.
	HealthWall = 10
)

// releaseLockScript is a Redis Lua script that provides a safe, atomic way to
// release a tile lock. It guarantees that a player can only delete a lock
// if they are the current owner of it, preventing race conditions.
var releaseLockScript = redis.NewScript(`
    -- KEYS[1] will be the lock key, e.g., "lock:tile:5,5"
    -- ARGV[1] will be the player's ID, e.g., "player:uuid-..."

    -- Check if the value of the key matches the player's ID.
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        -- If it matches, we are the owner. It is safe to delete.
        return redis.call("DEL", KEYS[1])
    else
        -- If it does not match, another player has claimed this lock,
        -- or the lock expired. Do nothing to avoid deleting their lock.
        return 0
    end
`)
