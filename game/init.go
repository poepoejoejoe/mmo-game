package game

import (
	"context"

	"github.com/go-redis/redis/v8"
)

// Package-level variables to hold the Redis client and context
var (
	rdb               *redis.Client
	ctx               = context.Background()
	releaseLockScript *redis.Script
)

// SendDirectMessageFunc is a function type for sending a message to a specific client.
type SendDirectMessageFunc func(playerID string, message []byte)

// IsPlayerOnlineFunc checks if a player has an active client connection.
type IsPlayerOnlineFunc func(playerID string) bool

var sendDirectMessage SendDirectMessageFunc
var IsPlayerOnline IsPlayerOnlineFunc

// Init initializes the game package with a Redis client.
func Init(redisClient *redis.Client, directMessageFunc SendDirectMessageFunc, isOnlineFunc IsPlayerOnlineFunc) {
	rdb = redisClient
	sendDirectMessage = directMessageFunc
	IsPlayerOnline = isOnlineFunc
	loadScripts()
	InitCollisionGrid()
}

func StartDamageSystem() {
	handleFireDamage()
}

func loadScripts() {
	// This script safely releases a lock only if the entityID matches.
	luaScript := `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`
	releaseLockScript = redis.NewScript(luaScript)
}
