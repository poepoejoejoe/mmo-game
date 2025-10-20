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

var sendDirectMessage SendDirectMessageFunc

// Init initializes the game package with a Redis client.
func Init(redisClient *redis.Client, directMessageFunc SendDirectMessageFunc) {
	rdb = redisClient
	sendDirectMessage = directMessageFunc
	loadScripts()
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
