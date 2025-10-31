package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"

	"github.com/go-redis/redis/v8"
)

func ProcessDepositItem(playerID string, payload json.RawMessage) (*models.InventoryUpdateMessage, *models.BankUpdateMessage) {
	var depositData models.DepositItemPayload
	if err := json.Unmarshal(payload, &depositData); err != nil {
		return nil, nil
	}

	inventoryKey := "inventory:" + playerID
	bankKey := "bank:" + playerID

	// Logic to move item from inventory to bank
	itemJSON, err := rdb.HGet(ctx, inventoryKey, depositData.Slot).Result()
	if err != nil {
		return nil, nil // Item not found
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	if depositData.Quantity <= 0 || depositData.Quantity > item.Quantity {
		return nil, nil // Invalid quantity
	}

	// Remove from inventory
	remainingQuantity := item.Quantity - depositData.Quantity
	pipe := rdb.Pipeline()
	if remainingQuantity > 0 {
		item.Quantity = remainingQuantity
		newItemJSON, _ := json.Marshal(item)
		pipe.HSet(ctx, inventoryKey, depositData.Slot, string(newItemJSON))
	} else {
		pipe.HSet(ctx, inventoryKey, depositData.Slot, "")
	}

	// Add to bank
	err = addItemToBank(pipe, bankKey, item.ID, depositData.Quantity)
	if err != nil {
		log.Printf("Failed to add item to bank for player %s: %v", playerID, err)
		return nil, nil
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error in deposit pipeline for player %s: %v", playerID, err)
		return nil, nil
	}

	return getInventoryUpdateMessage(inventoryKey), getBankUpdateMessage(bankKey)
}

func ProcessWithdrawItem(playerID string, payload json.RawMessage) (*models.InventoryUpdateMessage, *models.BankUpdateMessage) {
	var withdrawData models.WithdrawItemPayload
	if err := json.Unmarshal(payload, &withdrawData); err != nil {
		return nil, nil
	}
	inventoryKey := "inventory:" + playerID
	bankKey := "bank:" + playerID

	itemJSON, err := rdb.HGet(ctx, bankKey, withdrawData.Slot).Result()
	if err != nil {
		return nil, nil
	}
	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	if withdrawData.Quantity <= 0 || withdrawData.Quantity > item.Quantity {
		return nil, nil
	}

	pipe := rdb.Pipeline()
	remainingQuantity := item.Quantity - withdrawData.Quantity
	if remainingQuantity > 0 {
		item.Quantity = remainingQuantity
		newItemJSON, _ := json.Marshal(item)
		pipe.HSet(ctx, bankKey, withdrawData.Slot, string(newItemJSON))
	} else {
		pipe.HSet(ctx, bankKey, withdrawData.Slot, "")
	}

	inventoryData, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, nil
	}
	_, _, err = addItemToPlayerInventory(pipe, inventoryKey, inventoryData, ItemID(item.ID), withdrawData.Quantity)
	if err != nil {
		log.Printf("Failed to add item to inventory for player %s: %v", playerID, err)
		return nil, nil
	}
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error in withdraw pipeline for player %s: %v", playerID, err)
		return nil, nil
	}
	return getInventoryUpdateMessage(inventoryKey), getBankUpdateMessage(bankKey)
}

func addItemToBank(pipe redis.Pipeliner, bankKey string, itemID string, quantity int) error {
	bankData, err := rdb.HGetAll(ctx, bankKey).Result()
	if err != nil {
		return err
	}

	// First, try to stack with existing items
	for i := 0; i < 64; i++ {
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
	for i := 0; i < 64; i++ {
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
