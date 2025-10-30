package game

import (
	"log"
	"math/rand"
	"mmo-game/game/utils"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// CreateWorldItem places a new item into the world at a specific location.
func CreateWorldItem(x, y int, itemID ItemID, quantity int, ownerID string, expiry time.Duration) (string, int64, int64, error) {
	// Generate a unique ID for the item drop
	dropID := string(ItemPrefix) + utils.GenerateUniqueID()
	createdAt := time.Now().UnixMilli()
	var publicAt int64
	if expiry > 0 && ownerID != "" {
		publicAt = createdAt + expiry.Milliseconds()
	}

	pipe := rdb.Pipeline()

	// Set item properties
	pipe.HSet(ctx, dropID,
		"entityType", string(EntityTypeItem),
		"itemId", string(itemID),
		"quantity", quantity,
		"x", x,
		"y", y,
		"owner", ownerID, // The player who gets initial access to it
		"createdAt", createdAt,
		"publicAt", publicAt,
	)

	// Add to geospatial index
	lon, lat := NormalizeCoords(x, y)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
		Name:      dropID,
		Longitude: lon,
		Latitude:  lat,
	})

	// Set an expiration time for the item drop - THIS IS WRONG, it deletes the item
	/*
		if expiry > 0 {
			pipe.Expire(ctx, dropID, expiry)
		}
	*/
	// TODO: When this expires, we also need to remove it from the geospatial index.
	// A separate cleanup process will be needed for that.

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to create world item %s: %v", itemID, err)
		return "", 0, 0, err
	}

	if expiry > 0 && ownerID != "" {
		time.AfterFunc(expiry, func() {
			makeItemPublic(dropID)
		})
	}

	log.Printf("Created world item %s at (%d, %d)", itemID, x, y)
	return dropID, createdAt, publicAt, nil
}

func makeItemPublic(dropID string) {
	// First, check if the item still exists. It might have been picked up.
	itemData, err := rdb.HGetAll(ctx, dropID).Result()
	if err != nil || len(itemData) == 0 {
		log.Printf("Item %s no longer exists, skipping public transition.", dropID)
		return // Item doesn't exist, nothing to do.
	}

	// If it's already public, we're done.
	if itemData["owner"] == "" {
		return
	}

	// Update the owner to be public (empty string).
	if err := rdb.HSet(ctx, dropID, "owner", "").Err(); err != nil {
		log.Printf("Failed to update item %s to public: %v", dropID, err)
		return
	}

	// Announce the change to all players.
	// We re-use the EntityJoined event; clients will treat this as an upsert.
	x, _ := strconv.Atoi(itemData["x"])
	y, _ := strconv.Atoi(itemData["y"])
	createdAt, _ := strconv.ParseInt(itemData["createdAt"], 10, 64)
	publicAt, _ := strconv.ParseInt(itemData["publicAt"], 10, 64)

	itemUpdate := map[string]interface{}{
		"type":       string(ServerEventEntityJoined),
		"entityId":   dropID,
		"entityType": string(EntityTypeItem),
		"itemId":     itemData["itemId"],
		"x":          x,
		"y":          y,
		"owner":      "", // This is the important change
		"createdAt":  createdAt,
		"publicAt":   publicAt,
	}
	PublishUpdate(itemUpdate)
	log.Printf("Item %s is now public and an update has been broadcast.", dropID)
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
