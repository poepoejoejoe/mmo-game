package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
)

func ProcessLearnRecipe(playerID string, payload json.RawMessage) {
	var learnRecipePayload models.LearnRecipePayload
	if err := json.Unmarshal(payload, &learnRecipePayload); err != nil {
		log.Printf("error unmarshalling learn recipe payload: %v", err)
		return
	}

	canAct, _ := CanEntityAct(playerID)
	if !canAct {
		return
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	itemJSON, err := rdb.HGet(ctx, inventoryKey, learnRecipePayload.InventorySlot).Result()
	if err != nil || itemJSON == "" {
		log.Printf("item not found in slot %s for player %s", learnRecipePayload.InventorySlot, playerID)
		return
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	itemProps := ItemDefs[ItemID(item.ID)]
	if itemProps.Kind != ItemKindRecipe {
		log.Printf("item %s is not a recipe", item.ID)
		return
	}

	knownRecipesJSON, _ := rdb.HGet(ctx, playerID, "knownRecipes").Result()
	var knownRecipes map[string]bool
	json.Unmarshal([]byte(knownRecipesJSON), &knownRecipes)

	if knownRecipes == nil {
		knownRecipes = make(map[string]bool)
	}

	knownRecipes[string(itemProps.RecipeID)] = true
	newKnownRecipesJSON, _ := json.Marshal(knownRecipes)

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "knownRecipes", newKnownRecipesJSON)
	pipe.HDel(ctx, inventoryKey, learnRecipePayload.InventorySlot)
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("error executing learn recipe pipeline: %v", err)
		return
	}

	// Notify the client
	msg := models.RecipeLearnedMessage{
		Type:     "recipe_learned",
		RecipeID: string(itemProps.RecipeID),
	}
	msgBytes, _ := json.Marshal(msg)
	sendDirectMessage(playerID, msgBytes)

	inventory, _ := GetInventory(playerID)
	inventoryUpdate := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: inventory,
	}
	inventoryUpdateBytes, _ := json.Marshal(inventoryUpdate)
	sendDirectMessage(playerID, inventoryUpdateBytes)
}
