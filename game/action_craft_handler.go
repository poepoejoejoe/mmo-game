package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

// CraftActionHandler handles client craft actions.
// This implements the ActionHandler interface for standardized action processing.
type CraftActionHandler struct{}

// Process handles a craft action request from the client.
// It validates ingredients, consumes them, creates the item, and sends updates.
func (h *CraftActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var craftData models.CraftPayload
	if err := json.Unmarshal(payload, &craftData); err != nil {
		return Failed()
	}

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	recipe, ok := RecipeDefs[ItemID(craftData.Item)]
	if !ok {
		log.Printf("Player %s tried to craft unknown item: %s", playerID, craftData.Item)
		return Failed()
	}

	// Special crafting conditions: cooked rat meat requires being next to fire
	if ItemID(craftData.Item) == ItemCookedRatMeat {
		playerX, playerY := GetEntityPosition(playerData)
		isNextToFire := false
		for dx := -1; dx <= 1; dx++ {
			for dy := -1; dy <= 1; dy++ {
				if dx == 0 && dy == 0 {
					continue // Skip the player's own tile
				}
				// Check adjacent tiles only (cardinal directions)
				if dx != 0 && dy != 0 {
					continue
				}

				checkX, checkY := playerX+dx, playerY+dy
				tile, _, err := GetWorldTile(checkX, checkY)
				if err == nil && tile != nil && tile.Type == string(TileTypeFire) {
					isNextToFire = true
					break
				}
			}
			if isNextToFire {
				break
			}
		}

		if !isNextToFire {
			log.Printf("Player %s failed to craft %s: not next to a fire.", playerID, craftData.Item)
			return Failed()
		}
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return Failed()
	}

	// Tally up available ingredients
	available := make(map[ItemID]int)
	inventorySlots := make(map[string]models.Item)
	for i := 0; i < InventorySize; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			available[ItemID(item.ID)] += item.Quantity
			inventorySlots[slotKey] = item
		}
	}

	// Check if player has enough ingredients
	for ingredient, required := range recipe.Ingredients {
		if available[ingredient] < required {
			log.Printf("Player %s failed to craft %s: not enough %s.", playerID, craftData.Item, ingredient)
			return Failed()
		}
	}

	pipe := rdb.Pipeline()

	// Consume ingredients
	for ingredient, required := range recipe.Ingredients {
		remaining := required
		for slotKey, item := range inventorySlots {
			if ItemID(item.ID) == ingredient {
				consume := min(remaining, item.Quantity)
				item.Quantity -= consume
				remaining -= consume

				if item.Quantity > 0 {
					newItemJSON, _ := json.Marshal(item)
					pipe.HSet(ctx, inventoryKey, slotKey, string(newItemJSON))
					inventorySlots[slotKey] = item // Update local state
				} else {
					pipe.HSet(ctx, inventoryKey, slotKey, "")
					delete(inventorySlots, slotKey) // Update local state
				}

				if remaining == 0 {
					break
				}
			}
		}
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Redis error during crafting (ingredient consumption) for player %s: %v", playerID, err)
		return Failed()
	}

	// Add crafted item
	finalInventory, err := AddItemToInventory(playerID, ItemID(craftData.Item), recipe.Yield)
	if err != nil {
		log.Printf("Redis error during crafting (adding item) for player %s: %v", playerID, err)
		return Failed()
	}

	// Add experience
	if recipe.CraftingSkill != "" && recipe.CraftingXP > 0 {
		AddExperience(playerID, recipe.CraftingSkill, recipe.CraftingXP)
	}

	// Check quest objectives
	CheckObjectives(playerID, models.ObjectiveCraft, craftData.Item)
	if ItemID(craftData.Item) == ItemCookedRatMeat {
		CheckObjectives(playerID, models.ObjectiveCook, craftData.Item)
	}

	// Set cooldown
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	// Build result messages
	result := NewActionResult()

	// Send inventory update
	inventoryUpdateMsg := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: finalInventory,
	}
	inventoryJSON, _ := json.Marshal(inventoryUpdateMsg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    inventoryUpdateMsg.Type,
		Payload: inventoryJSON,
	})

	// Send craft success message
	craftSuccessMsg := &models.CraftSuccessMessage{
		Type:   string(ServerEventCraftSuccess),
		ItemID: craftData.Item,
	}
	craftJSON, _ := json.Marshal(craftSuccessMsg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    craftSuccessMsg.Type,
		Payload: craftJSON,
	})

	log.Printf("Player %s successfully crafted %d %s.", playerID, recipe.Yield, craftData.Item)
	return result
}

