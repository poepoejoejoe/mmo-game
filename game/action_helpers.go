package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// --- RENAMED ---
// CanEntityAct checks if an entity is off cooldown and returns their data.
// It fetches entity data and checks their 'nextActionAt' timestamp.
func CanEntityAct(entityID string) (bool, map[string]string) {
	entityData, err := rdb.HGetAll(ctx, entityID).Result()
	if err != nil {
		log.Printf("Failed to get entity data for %s: %v", entityID, err)
		return false, nil
	}

	if healthStr, ok := entityData["health"]; ok {
		health, _ := strconv.Atoi(healthStr)
		if health <= 0 {
			return false, entityData
		}
	}

	nextActionAt, _ := strconv.ParseInt(entityData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return false, entityData // On cooldown
	}

	return true, entityData
}

// --- RENAMED ---
// GetEntityPosition parses X and Y coordinates from entity data.
func GetEntityPosition(playerData map[string]string) (int, int) {
	x, _ := strconv.Atoi(playerData["x"])
	y, _ := strconv.Atoi(playerData["y"])
	return x, y
}

func AddItemToInventory(playerID string, itemID ItemID, quantity int) (map[string]models.Item, error) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, err
	}

	inventory := make(map[string]models.Item)
	slots := make([]*models.Item, 10) // Array of pointers to items for easy modification

	// Deserialize inventory
	for i := 0; i < 10; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			inventory[slotKey] = item
			slots[i] = &item
		}
	}

	itemProps := ItemDefs[itemID]
	remainingQuantity := quantity

	// First pass: stack with existing items
	if itemProps.Stackable {
		for _, item := range slots {
			if item != nil && item.ID == string(itemID) && item.Quantity < itemProps.MaxStack {
				addAmount := min(remainingQuantity, itemProps.MaxStack-item.Quantity)
				item.Quantity += addAmount
				remainingQuantity -= addAmount
				if remainingQuantity == 0 {
					break
				}
			}
		}
	}

	// Second pass: add to empty slots
	if remainingQuantity > 0 {
		// Second pass: add to empty slots
		addedItem := false
		if remainingQuantity > 0 {
			for i, item := range slots {
				if item == nil {
					if itemProps.Stackable {
						addAmount := min(remainingQuantity, itemProps.MaxStack)
						slots[i] = &models.Item{ID: string(itemID), Quantity: addAmount}
						remainingQuantity -= addAmount
					} else {
						slots[i] = &models.Item{ID: string(itemID), Quantity: 1}
						remainingQuantity--
					}
					addedItem = true
					if remainingQuantity == 0 {
						break
					}
				}
			}
		}
		if !addedItem {
			// If no items were added (e.g., inventory full), we still need to
			// return the current state of the inventory, not nil.
			currentInventory := make(map[string]models.Item)
			for i, item := range slots {
				if item != nil {
					currentInventory["slot_"+strconv.Itoa(i)] = *item
				}
			}
			return currentInventory, nil
		}
	}

	// Update Redis and the final map
	pipe := rdb.Pipeline()
	finalInventory := make(map[string]models.Item)
	for i, item := range slots {
		slotKey := "slot_" + strconv.Itoa(i)
		if item != nil {
			itemJSON, _ := json.Marshal(*item)
			pipe.HSet(ctx, inventoryKey, slotKey, string(itemJSON))
			finalInventory[slotKey] = *item
		} else {
			pipe.HSet(ctx, inventoryKey, slotKey, "")
		}
	}
	_, err = pipe.Exec(ctx)
	if err != nil {
		return nil, err
	}

	return finalInventory, nil
}

func RemoveItemFromInventory(playerID string, itemID ItemID, quantity int) (map[string]models.Item, error) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, err
	}

	inventory := make(map[string]models.Item)
	slots := make(map[string]*models.Item)

	// Deserialize inventory
	for i := 0; i < 10; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			inventory[slotKey] = item
			slots[slotKey] = &item
		}
	}

	remainingToRemove := quantity

	// Find and remove items
	for _, item := range slots {
		if item != nil && item.ID == string(itemID) {
			removeAmount := min(remainingToRemove, item.Quantity)
			item.Quantity -= removeAmount
			remainingToRemove -= removeAmount

			if remainingToRemove == 0 {
				break
			}
		}
	}

	// Update Redis and build the final inventory map
	pipe := rdb.Pipeline()
	finalInventory := make(map[string]models.Item)
	for i := 0; i < 10; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if item, ok := slots[slotKey]; ok && item != nil {
			if item.Quantity > 0 {
				itemJSON, _ := json.Marshal(*item)
				pipe.HSet(ctx, inventoryKey, slotKey, string(itemJSON))
				finalInventory[slotKey] = *item
			} else {
				pipe.HSet(ctx, inventoryKey, slotKey, "")
			}
		}
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		return nil, err
	}

	return finalInventory, nil
}

func HasItemInInventory(playerID string, itemID ItemID, quantity int) bool {
	inventory, err := GetInventory(playerID)
	if err != nil {
		return false
	}

	total := 0
	for _, item := range inventory {
		if item.ID == string(itemID) {
			total += item.Quantity
		}
	}
	return total >= quantity
}

// IsAdjacent checks if (x1, y1) is cardinally adjacent to (x2, y2).
func IsAdjacent(x1, y1, x2, y2 int) bool {
	dx := (x1 - x2)
	dy := (y1 - y2)
	distSq := (dx * dx) + (dy * dy)
	return distSq == 1
}

func IsAdjacentOrDiagonal(x1, y1, x2, y2 int) bool {
	dx := x1 - x2
	if dx < 0 {
		dx = -dx
	}
	dy := y1 - y2
	if dy < 0 {
		dy = -dy
	}
	return dx <= 1 && dy <= 1 && (dx != 0 || dy != 0)
}

func IsWithinPickupRange(x1, y1, x2, y2 int) bool {
	dx := x1 - x2
	if dx < 0 {
		dx = -dx
	}
	dy := y1 - y2
	if dy < 0 {
		dy = -dy
	}
	return dx <= 1 && dy <= 1
}

// GetEntitiesInRange uses Redis geospatial queries to find entities of a certain type
// within a given tile radius of a central point (x, y).
func GetEntitiesInRange(x, y, radius int, entityType EntityType) []string {
	// Use the geo key for the correct zone (hardcoded to zone 0 for now)
	geoKey := string(RedisKeyZone0Positions)

	// Perform the search
	locations, err := rdb.GeoRadius(ctx, geoKey, float64(x), float64(y), &redis.GeoRadiusQuery{
		Radius:    TilesToKilometers(radius), // Convert tile radius to km
		Unit:      "km",
		WithDist:  false,
		WithCoord: false,
		Count:     0,     // Get all matches
		Sort:      "ASC", // Sort by distance
	}).Result()

	if err != nil {
		log.Printf("Error performing GeoRadius search: %v", err)
		return []string{}
	}

	// Filter the results by entity type
	var entityIDs []string
	for _, location := range locations {
		// The entity type is part of the key name (e.g., "player:uuid")
		if EntityType(location.Name[0:len(entityType)]) == entityType {
			entityIDs = append(entityIDs, location.Name)
		}
	}

	return entityIDs
}

// PublishUpdate sends a message to the Redis world_updates channel for broadcasting.
func PublishUpdate(message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling message for publish: %v", err)
		return
	}
	// Use Redis topic constant (if you add one, e.g., "world_updates")
	rdb.Publish(ctx, "world_updates", string(jsonMsg))
}

// PublishToPlayer sends a message to a single player via the main Redis pub/sub channel.
// The hub is responsible for decoding this and routing it to the correct client.
func PublishToPlayer(playerID string, message []byte) {
	wrappedMessage := map[string]interface{}{
		"__private_message": true,
		"targetId":          playerID,
		"payload":           json.RawMessage(message),
	}
	PublishUpdate(wrappedMessage)
}

// PublishPrivately sends a message to a single player.
func PublishPrivately(playerID string, message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling private message for publish: %v", err)
		return
	}
	PublishToPlayer(playerID, jsonMsg)
}

// TilesToKilometers converts a distance in game tiles to the approximate
// kilometer equivalent for use in Redis Geo queries.
func TilesToKilometers(tiles int) float64 {
	return float64(tiles) * KILOMETERS_PER_DEGREE
}

func GetInventory(playerID string) (map[string]models.Item, error) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, err
	}
	inventoryDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range inventoryDataRaw {
		if itemJSON == "" {
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		inventoryDataTyped[slot] = item
	}
	return inventoryDataTyped, nil
}

func GetGear(playerID string) (map[string]models.Item, error) {
	gearKey := string(RedisKeyPlayerGear) + playerID
	gearDataRaw, err := rdb.HGetAll(ctx, gearKey).Result()
	if err != nil {
		return nil, err
	}
	gearDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range gearDataRaw {
		if itemJSON == "" {
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		gearDataTyped[slot] = item
	}
	return gearDataTyped, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func UpdateEntityDirection(entityID string, targetX int, targetY int) {
	_, entityData := CanEntityAct(entityID)
	currentX, currentY := GetEntityPosition(entityData)

	dx := targetX - currentX
	dy := targetY - currentY

	var direction MoveDirection
	if Abs(dx) > Abs(dy) {
		if dx > 0 {
			direction = MoveDirectionRight
		} else {
			direction = MoveDirectionLeft
		}
	} else {
		if dy > 0 {
			direction = MoveDirectionDown
		} else {
			direction = MoveDirectionUp
		}
	}
	rdb.HSet(ctx, entityID, "direction", string(direction))
	updateMsg := map[string]interface{}{
		"type":      string(ServerEventEntityMoved),
		"entityId":  entityID,
		"x":         currentX,
		"y":         currentY,
		"direction": string(direction),
	}
	PublishUpdate(updateMsg)
}

func Abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
