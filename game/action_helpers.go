package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
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

// IsAdjacent checks if (x1, y1) is cardinally adjacent to (x2, y2).
func IsAdjacent(x1, y1, x2, y2 int) bool {
	dx := (x1 - x2)
	dy := (y1 - y2)
	distSq := (dx * dx) + (dy * dy)
	return distSq == 1
}

// GetWorldTile fetches a tile from Redis and unmarshals it and its properties.
func GetWorldTile(x, y int) (*models.WorldTile, *TileProperties, error) {
	coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
	// Use RedisKey constant
	tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), coordKey).Result()
	if err != nil {
		return nil, nil, err
	}

	var tile models.WorldTile
	if err := json.Unmarshal([]byte(tileJSON), &tile); err != nil {
		log.Printf("Failed to unmarshal tile at %s: %v", coordKey, err)
		return nil, nil, err
	}

	// --- BUG FIX ---
	// Cast tile.Type string to TileType for map lookup
	props, ok := TileDefs[TileType(tile.Type)]
	if !ok {
		log.Printf("Unknown tile type %s at %s", tile.Type, coordKey)
		// Fallback to ground properties to be safe
		props = TileDefs[TileTypeGround]
	}
	// --- END BUG FIX ---

	return &tile, &props, nil
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

// TilesToKilometers converts a distance in game tiles to the approximate
// kilometer equivalent for use in Redis Geo queries.
func TilesToKilometers(tiles int) float64 {
	return float64(tiles) * KILOMETERS_PER_DEGREE
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
