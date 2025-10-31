package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"time"
)

// DepositItemActionHandler handles client deposit item actions.
// This implements the ActionHandler interface for standardized action processing.
type DepositItemActionHandler struct{}

// Process handles a deposit item action request from the client.
// It moves items from inventory to bank and sends inventory/bank updates.
func (h *DepositItemActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var depositData models.DepositItemPayload
	if err := json.Unmarshal(payload, &depositData); err != nil {
		return Failed()
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	bankKey := "bank:" + playerID

	// Logic to move item from inventory to bank
	itemJSON, err := rdb.HGet(ctx, inventoryKey, depositData.Slot).Result()
	if err != nil {
		return Failed() // Item not found
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	if depositData.Quantity <= 0 || depositData.Quantity > item.Quantity {
		return Failed() // Invalid quantity
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
		return Failed()
	}

	pipe.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error in deposit pipeline for player %s: %v", playerID, err)
		return Failed()
	}

	// Build result messages
	result := NewActionResult()

	// Send inventory update
	inventoryUpdate := getInventoryUpdateMessage(inventoryKey)
	inventoryJSON, _ := json.Marshal(inventoryUpdate)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    inventoryUpdate.Type,
		Payload: inventoryJSON,
	})

	// Send bank update
	bankUpdate := getBankUpdateMessage(bankKey)
	bankJSON, _ := json.Marshal(bankUpdate)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    bankUpdate.Type,
		Payload: bankJSON,
	})

	return result
}

