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

	// 1. Find and consume the item
	slotInfo, err := FindItemInInventory(playerID, ItemID(eatData.Item), "")
	if err != nil || slotInfo.SlotKey == "" {
		log.Printf("Player %s tried to eat %s but has none.", playerID, eatData.Item)
		return Failed()
	}

	pipe := rdb.Pipeline()
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	_, err = ConsumeItemFromSlot(pipe, inventoryKey, slotInfo.SlotKey, 1)
	if err != nil {
		log.Printf("Player %s failed to consume item: %v", playerID, err)
		return Failed()
	}

	// 2. Heal the player
	health, _ := strconv.Atoi(playerData["health"])
	// Ensure health is at least 0 (handle empty string case)
	if health < 0 {
		health = 0
	}
	maxHealth := PlayerDefs.MaxHealth
	healAmount := edible.HealAmount

	newHealth := health + healAmount
	if newHealth > maxHealth {
		newHealth = maxHealth
	}

	// Always update health if it changed (even if already at max, to ensure consistency)
	if newHealth != health {
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
	inventoryUpdate := CreateInventoryUpdateMessage(playerID)
	if inventoryUpdate != nil {
		inventoryJSON, _ := json.Marshal(inventoryUpdate)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    inventoryUpdate.Type,
			Payload: inventoryJSON,
		})
	}

	// Send health update if health changed
	if newHealth != health {
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
		log.Printf("Player %s ate %s and healed from %d to %d/%d.", playerID, eatData.Item, health, newHealth, maxHealth)
	} else {
		log.Printf("Player %s ate %s but health did not change (%d/%d).", playerID, eatData.Item, health, maxHealth)
	}
	
	return result
}

