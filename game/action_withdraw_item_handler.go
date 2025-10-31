package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strings"
	"time"
)

// WithdrawItemActionHandler handles client withdraw item actions.
// This implements the ActionHandler interface for standardized action processing.
type WithdrawItemActionHandler struct{}

// Process handles a withdraw item action request from the client.
// It moves items from bank to inventory and sends inventory/bank updates.
func (h *WithdrawItemActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var withdrawData models.WithdrawItemPayload
	if err := json.Unmarshal(payload, &withdrawData); err != nil {
		return Failed()
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	bankKey := "bank:" + playerID

	itemJSON, err := rdb.HGet(ctx, bankKey, withdrawData.Slot).Result()
	if err != nil {
		return Failed()
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	if withdrawData.Quantity <= 0 || withdrawData.Quantity > item.Quantity {
		return Failed()
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
		return Failed()
	}

	_, _, err = addItemToPlayerInventory(pipe, inventoryKey, inventoryData, ItemID(item.ID), withdrawData.Quantity)
	if err != nil {
		log.Printf("Failed to add item to inventory for player %s: %v", playerID, err)
		if strings.Contains(err.Error(), "inventory full") {
			notification := CreateNotificationMessage("Your inventory is full.")
			SendPrivately(playerID, notification)
		}
		return Failed()
	}

	pipe.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error in withdraw pipeline for player %s: %v", playerID, err)
		return Failed()
	}

	// Build result messages
	result := NewActionResult()

	// Send inventory update
	inventoryUpdate := CreateInventoryUpdateMessage(playerID)
	if inventoryUpdate != nil {
		inventoryJSON, _ := json.Marshal(inventoryUpdate)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    inventoryUpdate.Type,
			Payload: inventoryJSON,
		})
	}

	// Send bank update
	bankUpdate := CreateBankUpdateMessage(playerID)
	if bankUpdate != nil {
		bankJSON, _ := json.Marshal(bankUpdate)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    bankUpdate.Type,
			Payload: bankJSON,
		})
	}

	return result
}

