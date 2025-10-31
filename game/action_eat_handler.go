package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

// EatActionHandler handles client eat actions.
// This implements the ActionHandler interface for standardized action processing.
type EatActionHandler struct{}

// Process handles an eat action request from the client.
// It validates the item is edible, consumes it, heals the player, and sends updates.
func (h *EatActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var eatData models.EatPayload
	if err := json.Unmarshal(payload, &eatData); err != nil {
		return Failed()
	}

	edible, ok := EdibleDefs[ItemID(eatData.Item)]
	if !ok {
		log.Printf("Player %s tried to eat non-edible item: %s", playerID, eatData.Item)
		return Failed()
	}

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	// 1. Check if player has the item and consume it
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return Failed()
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
		return Failed()
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
		return Failed()
	}

	// 3. Build result messages
	result := NewActionResult()
	
	// Send inventory update
	finalInventory, _ := GetInventory(playerID)
	inventoryUpdateMsg := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: finalInventory,
	}
	inventoryUpdateJSON, _ := json.Marshal(inventoryUpdateMsg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    inventoryUpdateMsg.Type,
		Payload: inventoryUpdateJSON,
	})

	// Send health update if health changed
	if newHealth > health {
		statsUpdateMsg := models.PlayerStatsUpdateMessage{
			Type:      string(ServerEventPlayerStatsUpdate),
			Health:    &newHealth,
			MaxHealth: &maxHealth,
		}
		statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    statsUpdateMsg.Type,
			Payload: statsUpdateJSON,
		})
	}

	log.Printf("Player %s ate %s and healed to %d/%d.", playerID, eatData.Item, newHealth, maxHealth)
	return result
}

