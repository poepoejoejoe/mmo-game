package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"time"
)

// ReorderItemActionHandler handles client reorder item actions.
// This implements the ActionHandler interface for standardized action processing.
type ReorderItemActionHandler struct{}

// Process handles a reorder item action request from the client.
// It swaps items between two slots in inventory or bank and sends updates.
func (h *ReorderItemActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var reorderData models.ReorderItemPayload
	if err := json.Unmarshal(payload, &reorderData); err != nil {
		return Failed()
	}

	// Validate container type
	if reorderData.Container != "inventory" && reorderData.Container != "bank" {
		return Failed()
	}

	// Validate slots are different
	if reorderData.FromSlot == reorderData.ToSlot {
		return Failed()
	}

	canAct, _ := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	var containerKey string
	if reorderData.Container == "inventory" {
		containerKey = string(RedisKeyPlayerInventory) + playerID
	} else {
		containerKey = "bank:" + playerID
	}

	// Validate slot format (basic check - slots should be "slot_0", "slot_1", etc.)
	if len(reorderData.FromSlot) < MinSlotKeyLength || len(reorderData.ToSlot) < MinSlotKeyLength {
		return Failed()
	}

	// Get items from both slots
	fromItemJSON, err := rdb.HGet(ctx, containerKey, reorderData.FromSlot).Result()
	if err != nil {
		log.Printf("Error getting from slot %s: %v", reorderData.FromSlot, err)
		return Failed()
	}

	toItemJSON, err := rdb.HGet(ctx, containerKey, reorderData.ToSlot).Result()
	if err != nil {
		log.Printf("Error getting to slot %s: %v", reorderData.ToSlot, err)
		return Failed()
	}

	// Swap the items
	pipe := rdb.Pipeline()
	pipe.HSet(ctx, containerKey, reorderData.FromSlot, toItemJSON)
	pipe.HSet(ctx, containerKey, reorderData.ToSlot, fromItemJSON)
	pipe.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error executing reorder pipeline for player %s: %v", playerID, err)
		return Failed()
	}

	// Build result messages
	result := NewActionResult()

	// Send appropriate update message
	if reorderData.Container == "inventory" {
		inventoryUpdate := CreateInventoryUpdateMessage(playerID)
		if inventoryUpdate != nil {
			inventoryJSON, _ := json.Marshal(inventoryUpdate)
			result.AddToPlayer(models.WebSocketMessage{
				Type:    inventoryUpdate.Type,
				Payload: inventoryJSON,
			})
		}
	} else {
		bankUpdate := CreateBankUpdateMessage(playerID)
		if bankUpdate != nil {
			bankJSON, _ := json.Marshal(bankUpdate)
			result.AddToPlayer(models.WebSocketMessage{
				Type:    bankUpdate.Type,
				Payload: bankJSON,
			})
		}
	}

	return result
}
