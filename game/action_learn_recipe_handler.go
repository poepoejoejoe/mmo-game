package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"time"
)

// LearnRecipeActionHandler handles client learn recipe actions.
// This implements the ActionHandler interface for standardized action processing.
type LearnRecipeActionHandler struct{}

// Process handles a learn recipe action request from the client.
// It consumes a recipe item from inventory and adds the recipe to the player's known recipes.
func (h *LearnRecipeActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var learnRecipePayload models.LearnRecipePayload
	if err := json.Unmarshal(payload, &learnRecipePayload); err != nil {
		return Failed()
	}

	canAct, _ := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	itemJSON, err := rdb.HGet(ctx, inventoryKey, learnRecipePayload.InventorySlot).Result()
	if err != nil || itemJSON == "" {
		log.Printf("item not found in slot %s for player %s", learnRecipePayload.InventorySlot, playerID)
		return Failed()
	}

	var item models.Item
	json.Unmarshal([]byte(itemJSON), &item)

	itemProps := ItemDefs[ItemID(item.ID)]
	if itemProps.Kind != ItemKindRecipe {
		log.Printf("item %s is not a recipe", item.ID)
		return Failed()
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
	pipe.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("error executing learn recipe pipeline: %v", err)
		return Failed()
	}

	// Build result messages
	result := NewActionResult()

	// Send recipe learned message
	msg := models.RecipeLearnedMessage{
		Type:     string(ServerEventRecipeLearned),
		RecipeID: string(itemProps.RecipeID),
	}
	msgBytes, _ := json.Marshal(msg)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    msg.Type,
		Payload: msgBytes,
	})

	// Send inventory update
	inventory, _ := GetInventory(playerID)
	inventoryUpdate := &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: inventory,
	}
	inventoryUpdateBytes, _ := json.Marshal(inventoryUpdate)
	result.AddToPlayer(models.WebSocketMessage{
		Type:    inventoryUpdate.Type,
		Payload: inventoryUpdateBytes,
	})

	log.Printf("Player %s learned recipe: %s", playerID, itemProps.RecipeID)
	return result
}

