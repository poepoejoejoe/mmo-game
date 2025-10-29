package game

import (
	"strconv"

	"github.com/go-redis/redis/v8"
)

// LockTileForEntity attempts to acquire a lock on a specific tile for a given entity.
// It returns true if the lock was acquired, false otherwise.
func LockTileForEntity(entityID string, x, y int) (bool, error) {
	tileKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
	return rdb.SetNX(ctx, tileKey, entityID, 0).Result()
}

// UnlockTileForEntity releases a lock on a tile, but only if the provided entityID
// is the current owner of the lock.
func UnlockTileForEntity(entityID string, x, y int) error {
	tileKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
	_, err := releaseLockScript.Run(ctx, rdb, []string{tileKey}, entityID).Result()
	if err != redis.Nil {
		return err
	}
	return nil
}

// IsTileLocked checks if a tile is currently locked by any entity.
func IsTileLocked(x, y int) bool {
	tileKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
	val, err := rdb.Exists(ctx, tileKey).Result()
	if err != nil {
		return true // Assume locked on error to be safe
	}
	return val == 1
}
