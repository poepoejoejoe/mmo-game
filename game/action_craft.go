package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

func ProcessCraft(playerID string, payload json.RawMessage) ([]*models.InventoryUpdateMessage, *models.StateCorrectionMessage) {
	var craftData models.CraftPayload
	if err := json.Unmarshal(payload, &craftData); err != nil {
		return nil, nil
	}

	canAct, _ := CanPlayerAct(playerID)
	if !canAct {
		return nil, nil
	}

	recipe, ok := RecipeDefs[craftData.Item]
	if !ok {
		log.Printf("Player %s tried to craft unknown item: %s", playerID, craftData.Item)
		return nil, nil
	}

	inventoryKey := "player:inventory:" + playerID
	var updates []*models.InventoryUpdateMessage

	// Check if the player has all required ingredients
	for ingredient, requiredAmount := range recipe.Ingredients {
		currentAmountStr, err := rdb.HGet(ctx, inventoryKey, ingredient).Result()
		if err != nil {
			currentAmountStr = "0"
		}
		currentAmount, _ := strconv.Atoi(currentAmountStr)

		if currentAmount < requiredAmount {
			log.Printf("Player %s failed to craft %s: not enough %s.", playerID, craftData.Item, ingredient)
			return nil, nil
		}
	}

	// Atomically update inventory
	pipe := rdb.Pipeline()
	// Subtract all ingredients
	for ingredient, requiredAmount := range recipe.Ingredients {
		newAmount := pipe.HIncrBy(ctx, inventoryKey, ingredient, int64(-requiredAmount))
		updates = append(updates, &models.InventoryUpdateMessage{
			Type: "inventory_update", Resource: ingredient, Amount: int(newAmount.Val()),
		})
	}
	// Add the crafted item(s)
	newCraftedAmount := pipe.HIncrBy(ctx, inventoryKey, craftData.Item, int64(recipe.Yield))
	updates = append(updates, &models.InventoryUpdateMessage{
		Type: "inventory_update", Resource: craftData.Item, Amount: int(newCraftedAmount.Val()),
	})

	cmders, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Redis error during crafting for player %s: %v", playerID, err)
		return nil, nil
	}

	// Populate the update messages with the actual final values from Redis
	for i, cmder := range cmders {
		if intCmd, ok := cmder.(*redis.IntCmd); ok {
			updates[i].Amount = int(intCmd.Val())
		}
	}

	log.Printf("Player %s successfully crafted %d %s.", playerID, recipe.Yield, craftData.Item)
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	return updates, nil
}
