package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

func ProcessEquip(playerID string, payload json.RawMessage) (*models.InventoryUpdateMessage, *models.GearUpdateMessage) {
	var equipData models.EquipPayload
	if err := json.Unmarshal(payload, &equipData); err != nil {
		log.Printf("error unmarshalling equip payload: %v", err)
		return nil, nil
	}

	canAct, _ := CanEntityAct(playerID)
	if !canAct {
		return nil, nil
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	gearKey := string(RedisKeyPlayerGear) + playerID

	// Get the item from the specified inventory slot
	itemJSON, err := rdb.HGet(ctx, inventoryKey, equipData.InventorySlot).Result()
	if err != nil || itemJSON == "" {
		log.Printf("item not found in slot %s for player %s", equipData.InventorySlot, playerID)
		return nil, nil
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	itemProps := ItemDefs[ItemID(item.ID)]
	if itemProps.Equippable == nil {
		log.Printf("item %s is not equippable", item.ID)
		return nil, nil
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
		return nil, nil
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
	PublishUpdate(appearanceUpdateMsg)

	inventoryUpdate := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: newInventory,
	}
	gearUpdate := &models.GearUpdateMessage{
		Type: string(ServerEventGearUpdate),
		Gear: newGear,
	}

	return inventoryUpdate, gearUpdate
}

func ProcessUnequip(playerID string, payload json.RawMessage) (*models.InventoryUpdateMessage, *models.GearUpdateMessage) {
	var unequipData models.UnequipPayload
	if err := json.Unmarshal(payload, &unequipData); err != nil {
		log.Printf("error unmarshalling unequip payload: %v", err)
		return nil, nil
	}

	canAct, _ := CanEntityAct(playerID)
	if !canAct {
		return nil, nil
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	gearKey := string(RedisKeyPlayerGear) + playerID

	// Get the item from the specified gear slot
	itemJSON, err := rdb.HGet(ctx, gearKey, unequipData.GearSlot).Result()
	if err != nil || itemJSON == "" {
		log.Printf("no item found in gear slot %s for player %s", unequipData.GearSlot, playerID)
		return nil, nil
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
		// Maybe send a "inventory full" message to the client in the future
		return nil, nil
	}

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, gearKey, unequipData.GearSlot, "")
	pipe.HSet(ctx, inventoryKey, emptySlot, itemJSON)
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("error executing unequip pipeline: %v", err)
		return nil, nil
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
	PublishUpdate(appearanceUpdateMsg)

	inventoryUpdate := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: newInventory,
	}
	gearUpdate := &models.GearUpdateMessage{
		Type: string(ServerEventGearUpdate),
		Gear: newGear,
	}

	return inventoryUpdate, gearUpdate
}
