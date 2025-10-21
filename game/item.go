package game

import (
	"log"
	"math/rand"
	"mmo-game/game/utils"
	"time"

	"github.com/go-redis/redis/v8"
)

// CreateWorldItem places a new item into the world at a specific location.
func CreateWorldItem(x, y int, itemID ItemID, quantity int, ownerID string, expiry time.Duration) (string, error) {
	// Generate a unique ID for the item drop
	dropID := string(ItemPrefix) + utils.GenerateUniqueID()

	pipe := rdb.Pipeline()

	// Set item properties
	pipe.HSet(ctx, dropID,
		"entityType", string(EntityTypeItem),
		"itemId", string(itemID),
		"quantity", quantity,
		"x", x,
		"y", y,
		"owner", ownerID, // The player who gets initial access to it
		"createdAt", time.Now().UnixMilli(),
	)

	// Add to geospatial index for quick lookups
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      dropID,
		Longitude: float64(x),
		Latitude:  float64(y),
	})

	// Set an expiration time for the item drop
	if expiry > 0 {
		pipe.Expire(ctx, dropID, expiry)
	}
	// TODO: When this expires, we also need to remove it from the geospatial index.
	// A separate cleanup process will be needed for that.

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to create world item %s: %v", itemID, err)
		return "", err
	}

	log.Printf("Created world item %s at (%d, %d)", itemID, x, y)
	return dropID, nil
}

// generateLoot determines what loot to drop based on the NPC's loot table.
func generateLoot(npcType NPCType) map[ItemID]int {
	drops := make(map[ItemID]int)
	table, ok := NPCLootTables[npcType]
	if !ok {
		return drops // No loot table for this NPC type
	}

	for _, entry := range table {
		if rand.Float64() < entry.Chance {
			quantity := rand.Intn(entry.Max-entry.Min+1) + entry.Min
			drops[entry.ItemID] += quantity
		}
	}

	return drops
}
