package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

func ProcessCraft(playerID string, payload json.RawMessage) (*models.InventoryUpdateMessage, *models.StateCorrectionMessage, *models.CraftSuccessMessage) {
	var craftData models.CraftPayload
	if err := json.Unmarshal(payload, &craftData); err != nil {
		return nil, nil, nil
	}

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return nil, nil, nil
	}

	recipe, ok := RecipeDefs[ItemID(craftData.Item)]
	if !ok {
		log.Printf("Player %s tried to craft unknown item: %s", playerID, craftData.Item)
		return nil, nil, nil
	}

	// --- NEW: Special crafting conditions ---
	if ItemID(craftData.Item) == ItemCookedRatMeat {
		playerX, playerY := GetEntityPosition(playerData)
		isNextToFire := false
		for dx := -1; dx <= 1; dx++ {
			for dy := -1; dy <= 1; dy++ {
				if dx == 0 && dy == 0 {
					continue // Skip the player's own tile
				}
				// Check adjacent tiles only
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
			return nil, nil, nil // Or send a specific "requires fire" message
		}
	}
	// --- END NEW ---

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, nil, nil
	}

	// Tally up available ingredients
	available := make(map[ItemID]int)
	inventorySlots := make(map[string]models.Item)
	for i := 0; i < 10; i++ {
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
			return nil, nil, nil
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
		return nil, nil, nil
	}

	// Add crafted item
	finalInventory, err := AddItemToInventory(playerID, ItemID(craftData.Item), recipe.Yield)
	if err != nil {
		log.Printf("Redis error during crafting (adding item) for player %s: %v", playerID, err)
		// Note: This could leave the inventory in an inconsistent state.
		// A more robust solution would use Lua scripting for atomicity.
		return nil, nil, nil
	}

	// --- NEW: Quest Completion Check ---
	playerQuests, err := GetPlayerQuests(playerID)
	if err == nil {
		buildWallQuest := playerQuests.Quests[models.QuestBuildAWall]
		if buildWallQuest != nil && !buildWallQuest.IsComplete && ItemID(craftData.Item) == ItemWoodenWall {
			UpdateObjective(playerQuests, models.QuestBuildAWall, "craft_wall", playerID)
			SavePlayerQuests(playerID, playerQuests)
		}

		ratProblemQuest := playerQuests.Quests[models.QuestRatProblem]
		if ratProblemQuest != nil && !ratProblemQuest.IsComplete && ItemID(craftData.Item) == ItemCookedRatMeat {
			UpdateObjective(playerQuests, models.QuestRatProblem, "cook_rat_meat", playerID)
			SavePlayerQuests(playerID, playerQuests)
		}
	}
	// --- END NEW ---

	inventoryUpdateMsg := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: finalInventory,
	}

	craftSuccessMsg := &models.CraftSuccessMessage{
		Type:   string(ServerEventCraftSuccess),
		ItemID: craftData.Item,
	}

	log.Printf("Player %s successfully crafted %d %s.", playerID, recipe.Yield, craftData.Item)
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	return inventoryUpdateMsg, nil, craftSuccessMsg
}
