package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

// UnequipActionHandler handles client unequip actions.
// This implements the ActionHandler interface for standardized action processing.
type UnequipActionHandler struct{}

// Process handles an unequip action request from the client.
// It moves an item from a gear slot back to inventory, requiring an empty inventory slot.
func (h *UnequipActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var unequipData models.UnequipPayload
	if err := json.Unmarshal(payload, &unequipData); err != nil {
		return Failed()
	}

	canAct, _ := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	gearKey := string(RedisKeyPlayerGear) + playerID

	// Get the item from the specified gear slot
	itemJSON, err := rdb.HGet(ctx, gearKey, unequipData.GearSlot).Result()
	if err != nil || itemJSON == "" {
		log.Printf("no item found in gear slot %s for player %s", unequipData.GearSlot, playerID)
		return Failed()
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	// Find an empty inventory slot
	inventoryDataRaw, _ := rdb.HGetAll(ctx, inventoryKey).Result()
	emptySlot := ""
	for i := 0; i < 10; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if inventoryDataRaw[slotKey] == "" {
			emptySlot = slotKey
			break
		}
	}

	if emptySlot == "" {
		log.Printf("no empty inventory slot for player %s", playerID)
		// Send notification to player about inventory full
		notification := CreateNotificationMessage("Your inventory is full.")
		SendPrivately(playerID, notification)
		return Failed()
	}

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, gearKey, unequipData.GearSlot, "")
	pipe.HSet(ctx, inventoryKey, emptySlot, itemJSON)
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("error executing unequip pipeline: %v", err)
		return Failed()
	}

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

	return result
}

