package game

import (
	"time"

	"github.com/go-redis/redis/v8"
)

const (
	BaseActionCooldown = 100 * time.Millisecond
	WaterMovePenalty   = 500 * time.Millisecond
	WorldSize          = 50
	WoodPerWall        = 10
	// REMOVED: HealthTree, HealthRock, HealthWall are now in definitions.go
)

var releaseLockScript = redis.NewScript(`
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
    else
        return 0
    end
`)
