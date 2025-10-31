package game

import (
	"encoding/json"
	"fmt"
	"mmo-game/models"
	"strconv"

	"github.com/go-redis/redis/v8"
)

// InventorySlotInfo represents information about an item in a specific inventory slot.
type InventorySlotInfo struct {
	SlotKey string
	Item    models.Item
}

// FindItemInInventory searches for an item in the player's inventory.
// Returns the slot key and item if found, or empty string and zero item if not found.
//
// Usage:
//   slotInfo := FindItemInInventory(playerID, ItemWood, "")
//   if slotInfo.SlotKey != "" {
//       // Item found in slotInfo.SlotKey with quantity slotInfo.Item.Quantity
//   }
func FindItemInInventory(playerID string, itemID ItemID, slotHint string) (InventorySlotInfo, error) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	var inventoryDataRaw map[string]string
	var err error

	// If slotHint is provided, check that slot first
	if slotHint != "" {
		itemJSON, err := rdb.HGet(ctx, inventoryKey, slotHint).Result()
		if err == nil && itemJSON != "" {
			var item models.Item
			if err := json.Unmarshal([]byte(itemJSON), &item); err == nil {
				if item.ID == string(itemID) {
					return InventorySlotInfo{SlotKey: slotHint, Item: item}, nil
				}
			}
		}
	}

	// Search all slots
	inventoryDataRaw, err = rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return InventorySlotInfo{}, err
	}

	for i := 0; i < InventorySize; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
			var item models.Item
			if err := json.Unmarshal([]byte(itemJSON), &item); err == nil {
				if item.ID == string(itemID) {
					return InventorySlotInfo{SlotKey: slotKey, Item: item}, nil
				}
			}
		}
	}

	return InventorySlotInfo{}, nil
}

// ConsumeItemFromSlot consumes a specified quantity of items from a specific inventory slot.
// Returns the remaining quantity in the slot after consumption, or an error if consumption fails.
// Updates the slot in the provided Redis pipeline.
//
// Usage:
//   pipe := rdb.Pipeline()
//   remaining, err := ConsumeItemFromSlot(pipe, inventoryKey, "slot_0", 1)
//   if err != nil {
//       return Failed()
//   }
func ConsumeItemFromSlot(pipe redis.Pipeliner, inventoryKey string, slotKey string, quantity int) (int, error) {
	itemJSON, err := rdb.HGet(ctx, inventoryKey, slotKey).Result()
	if err != nil || itemJSON == "" {
		return 0, fmt.Errorf("item not found in slot %s", slotKey)
	}

	var item models.Item
	if err := json.Unmarshal([]byte(itemJSON), &item); err != nil {
		return 0, fmt.Errorf("failed to unmarshal item: %v", err)
	}

	if item.Quantity < quantity {
		return 0, fmt.Errorf("insufficient quantity: have %d, need %d", item.Quantity, quantity)
	}

	remainingQuantity := item.Quantity - quantity

	if remainingQuantity > 0 {
		item.Quantity = remainingQuantity
		newItemJSON, _ := json.Marshal(item)
		pipe.HSet(ctx, inventoryKey, slotKey, string(newItemJSON))
		return remainingQuantity, nil
	} else {
		pipe.HSet(ctx, inventoryKey, slotKey, "")
		return 0, nil
	}
}

// ConsumeItemFromInventory consumes a specified quantity of an item from the player's inventory.
// It searches for the item and consumes it across multiple slots if necessary.
// Returns the updated inventory map on success.
//
// Usage:
//   newInventory, err := ConsumeItemFromInventory(playerID, ItemWood, 5)
//   if err != nil {
//       return Failed()
//   }
func ConsumeItemFromInventory(playerID string, itemID ItemID, quantity int) (map[string]models.Item, error) {
	return RemoveItemFromInventory(playerID, itemID, quantity)
}

// FindItemSlot returns the slot key where an item is located, or empty string if not found.
// This is a convenience wrapper around FindItemInInventory.
//
// Usage:
//   slotKey := FindItemSlot(playerID, ItemWood)
//   if slotKey != "" {
//       // Item found
//   }
func FindItemSlot(playerID string, itemID ItemID) string {
	slotInfo, _ := FindItemInInventory(playerID, itemID, "")
	return slotInfo.SlotKey
}

