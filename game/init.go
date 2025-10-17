package game

import (
	"context"

	"github.com/go-redis/redis/v8"
)

// Package-level variables to hold the Redis client and context
var (
	rdb *redis.Client
	ctx context.Context
)

// Init initializes the game package with the necessary database connections.
func Init(redisClient *redis.Client) {
	rdb = redisClient
	ctx = context.Background()
}
