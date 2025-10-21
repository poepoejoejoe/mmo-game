package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

func ProcessEat(playerID string, payload json.RawMessage) {
	var eatData models.EatPayload
	if err := json.Unmarshal(payload, &eatData); err != nil {
		return
	}

	edible, ok := EdibleDefs[ItemID(eatData.Item)]
	if !ok {
		log.Printf("Player %s tried to eat non-edible item: %s", playerID, eatData.Item)
		return
	}

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return
	}

	// 1. Check if player has the item and consume it
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return
	}

	itemSlot := ""
	var itemInSlot models.Item
	for i := 0; i < 10; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			if item.ID == eatData.Item {
				itemSlot = slotKey
				itemInSlot = item
				break
			}
		}
	}

	if itemSlot == "" {
		log.Printf("Player %s tried to eat %s but has none.", playerID, eatData.Item)
		return
	}

	pipe := rdb.Pipeline()
	// Consume the item
	if itemInSlot.Quantity > 1 {
		itemInSlot.Quantity--
		newItemJSON, _ := json.Marshal(itemInSlot)
		pipe.HSet(ctx, inventoryKey, itemSlot, string(newItemJSON))
	} else {
		pipe.HSet(ctx, inventoryKey, itemSlot, "")
	}

	// 2. Heal the player
	health, _ := strconv.Atoi(playerData["health"])
	maxHealth := PlayerDefs.MaxHealth
	healAmount := edible.HealAmount

	newHealth := health + healAmount
	if newHealth > maxHealth {
		newHealth = maxHealth
	}

	if newHealth > health {
		pipe.HSet(ctx, playerID, "health", newHealth)
	}

	pipe.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Redis error during eat action for player %s: %v", playerID, err)
		return
	}

	// 3. Send updates to the client
	// Send inventory update
	finalInventory, _ := GetInventory(playerID)
	inventoryUpdateMsg := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: finalInventory,
	}
	inventoryUpdateJSON, _ := json.Marshal(inventoryUpdateMsg)
	sendDirectMessage(playerID, inventoryUpdateJSON)

	// Send health update
	if newHealth > health {
		statsUpdateMsg := models.PlayerStatsUpdateMessage{
			Type:      string(ServerEventPlayerStatsUpdate),
			Health:    newHealth,
			MaxHealth: maxHealth,
		}
		statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
		sendDirectMessage(playerID, statsUpdateJSON)
	}

	log.Printf("Player %s ate %s and healed to %d/%d.", playerID, eatData.Item, newHealth, maxHealth)
}

func GetInventory(playerID string) (map[string]models.Item, error) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, err
	}
	inventoryDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range inventoryDataRaw {
		if itemJSON == "" {
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		inventoryDataTyped[slot] = item
	}
	return inventoryDataTyped, nil
}
