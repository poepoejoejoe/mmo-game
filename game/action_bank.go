package game

import (
	"encoding/json"
	"mmo-game/models"
	"strconv"

	"github.com/go-redis/redis/v8"
)

// addItemToBank adds an item to the bank inventory, stacking if possible or finding an empty slot.
func addItemToBank(pipe redis.Pipeliner, bankKey string, itemID string, quantity int) error {
	bankData, err := rdb.HGetAll(ctx, bankKey).Result()
	if err != nil {
		return err
	}

	// First, try to stack with existing items
	for i := 0; i < BankSize; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := bankData[slotKey]; ok && itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			if item.ID == itemID { // Assuming stackable, bank items should be
				item.Quantity += quantity
				newItemJSON, _ := json.Marshal(item)
				pipe.HSet(ctx, bankKey, slotKey, string(newItemJSON))
				return nil
			}
		}
	}

	// Second, find an empty slot
	for i := 0; i < BankSize; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := bankData[slotKey]; !ok || itemJSON == "" {
			newItem := models.Item{ID: itemID, Quantity: quantity}
			newItemJSON, _ := json.Marshal(newItem)
			pipe.HSet(ctx, bankKey, slotKey, string(newItemJSON))
			return nil
		}
	}

	return nil // Bank is full
}
