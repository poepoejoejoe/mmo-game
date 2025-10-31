package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"time"
)

// EquipActionHandler handles client equip actions.
// This implements the ActionHandler interface for standardized action processing.
type EquipActionHandler struct{}

// Process handles an equip action request from the client.
// It moves an item from inventory to a gear slot, swapping with any existing item.
func (h *EquipActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var equipData models.EquipPayload
	if err := json.Unmarshal(payload, &equipData); err != nil {
		return Failed()
	}

	canAct, _ := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	gearKey := string(RedisKeyPlayerGear) + playerID

	// Get the item from the specified inventory slot
	itemJSON, err := rdb.HGet(ctx, inventoryKey, equipData.InventorySlot).Result()
	if err != nil || itemJSON == "" {
		log.Printf("item not found in slot %s for player %s", equipData.InventorySlot, playerID)
		return Failed()
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	itemProps := ItemDefs[ItemID(item.ID)]
	if itemProps.Equippable == nil {
		log.Printf("item %s is not equippable", item.ID)
		return Failed()
	}

	gearSlot := itemProps.Equippable.Slot
	currentlyEquippedJSON, err := rdb.HGet(ctx, gearKey, gearSlot).Result()
	if err != nil {
		log.Printf("error getting currently equipped item: %v", err)
	}

	pipe := rdb.Pipeline()

	// Remove item from inventory
	pipe.HSet(ctx, inventoryKey, equipData.InventorySlot, "")

	// Equip the new item
	pipe.HSet(ctx, gearKey, gearSlot, itemJSON)

	// If an item was already equipped, move it to the now-empty inventory slot
	if currentlyEquippedJSON != "" {
		pipe.HSet(ctx, inventoryKey, equipData.InventorySlot, currentlyEquippedJSON)
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("error executing equip pipeline: %v", err)
		return Failed()
	}

	// Fetch updated inventory and gear to send to client
	newInventory, _ := GetInventory(playerID)
	newGear, _ := GetGear(playerID)

	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	// Announce the appearance change to the world
	appearanceUpdateMsg := map[string]interface{}{
		"type":     string(ServerEventPlayerAppearanceChanged),
		"entityId": playerID,
		"gear":     newGear,
	}
	Broadcast(appearanceUpdateMsg)

	// Build result messages
	result := NewActionResult()

	// Send inventory update
	inventoryUpdate := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: newInventory,
	}
	inventoryJSON, _ := json.Marshal(inventoryUpdate)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    inventoryUpdate.Type,
		Payload: inventoryJSON,
	})

	// Send gear update
	gearUpdate := &models.GearUpdateMessage{
		Type: string(ServerEventGearUpdate),
		Gear: newGear,
	}
	gearJSON, _ := json.Marshal(gearUpdate)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    gearUpdate.Type,
		Payload: gearJSON,
	})

	CheckObjectives(playerID, models.ObjectiveEquip, item.ID)

	return result
}

