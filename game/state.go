package game

import (
	"time"

	"github.com/go-redis/redis/v8"
)

// These constants are defined here and are visible to all other files
// in the 'game' package, including actions.go.
const (
	WaterMovePenalty = 500 * time.Millisecond
	BaseMoveCooldown = 100 * time.Millisecond
	WorldSize        = 50
)

var releaseLockScript = redis.NewScript(`
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
    else
        return 0
    end
`)
