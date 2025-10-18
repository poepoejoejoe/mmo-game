package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// ProcessMove is unchanged in this step.
func ProcessMove(playerID string, direction string) *models.StateCorrectionMessage {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return nil
	}
	nextActionAt, _ := strconv.ParseInt(playerData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return nil
	}

	currentX, _ := strconv.Atoi(playerData["x"])
	currentY, _ := strconv.Atoi(playerData["y"])
	targetX, targetY := currentX, currentY
	switch direction {
	case "up":
		targetY--
	case "down":
		targetY++
	case "left":
		targetX--
	case "right":
		targetX++
	}

	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)
	tileJSON, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
	if err != nil {
		return nil
	}
	var tile models.WorldTile
	json.Unmarshal([]byte(tileJSON), &tile)
	props := TileDefs[tile.Type]

	if props.IsCollidable {
		return nil
	}

	targetTileKey := "lock:tile:" + targetCoordKey
	wasSet, err := rdb.SetNX(ctx, targetTileKey, playerID, 0).Result()
	if err != nil || !wasSet {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}
	}

	cooldown := BaseActionCooldown
	if props.MovementPenalty {
		cooldown = WaterMovePenalty
	}
	nextActionTime := time.Now().Add(cooldown).UnixMilli()

	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "x", targetX, "y", targetY, "nextActionAt", nextActionTime)
	pipe.GeoAdd(ctx, "zone:0:positions", &redis.GeoLocation{Name: playerID, Longitude: float64(targetX), Latitude: float64(targetY)})
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error updating player state, rolling back lock for tile %s", targetCoordKey)
		releaseLockScript.Run(ctx, rdb, []string{targetTileKey}, playerID)
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}
	}

	currentTileKey := "lock:tile:" + strconv.Itoa(currentX) + "," + strconv.Itoa(currentY)
	releaseLockScript.Run(ctx, rdb, []string{currentTileKey}, playerID)

	updateMsg := map[string]interface{}{"type": "player_moved", "playerId": playerID, "x": targetX, "y": targetY}
	PublishUpdate(updateMsg)

	return nil
}

// ProcessInteract is unchanged in this step.
func ProcessInteract(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var interactData models.InteractPayload
	if err := json.Unmarshal(payload, &interactData); err != nil {
		return nil, nil
	}

	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return nil, nil
	}

	nextActionAt, _ := strconv.ParseInt(playerData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return nil, nil
	}

	currentX, _ := strconv.Atoi(playerData["x"])
	currentY, _ := strconv.Atoi(playerData["y"])

	targetX, targetY := interactData.X, interactData.Y
	if ((currentX-targetX)*(currentX-targetX) + (currentY-targetY)*(currentY-targetY)) != 1 {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
	}

	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)
	tileJSON, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
	if err != nil {
		return nil, nil
	}
	var tile models.WorldTile
	json.Unmarshal([]byte(tileJSON), &tile)
	props := TileDefs[tile.Type]
	originalTileType := tile.Type

	if !props.IsGatherable && !props.IsDestructible {
		return nil, nil
	}

	tile.Health--

	damageMsg := models.ResourceDamagedMessage{
		Type: "resource_damaged", X: targetX, Y: targetY, NewHealth: tile.Health,
	}
	PublishUpdate(damageMsg)

	var inventoryUpdateMsg *models.InventoryUpdateMessage
	if props.IsGatherable {
		newAmount, _ := rdb.HIncrBy(ctx, "player:inventory:"+playerID, props.GatherResource, 1).Result()
		inventoryUpdateMsg = &models.InventoryUpdateMessage{
			Type: "inventory_update", Resource: props.GatherResource, Amount: int(newAmount),
		}
	}

	if tile.Health <= 0 {
		tile.Type = "ground"
		groundTile := models.WorldTile{Type: "ground", Health: 0}
		worldUpdateMsg := models.WorldUpdateMessage{Type: "world_update", X: targetX, Y: targetY, Tile: groundTile}
		PublishUpdate(worldUpdateMsg)

		if originalTileType == "wooden_wall" {
			log.Printf("Wall at %s destroyed, removing lock.", targetCoordKey)
			rdb.Del(ctx, "lock:tile:"+targetCoordKey)
		}
	}

	newTileJSON, _ := json.Marshal(tile)
	rdb.HSet(ctx, "world:zone:0", targetCoordKey, string(newTileJSON))
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	return nil, inventoryUpdateMsg
}

// ProcessPlaceItem is unchanged in this step.
func ProcessPlaceItem(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var placeData models.PlaceItemPayload
	if err := json.Unmarshal(payload, &placeData); err != nil {
		return nil, nil
	}
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return nil, nil
	}
	nextActionAt, _ := strconv.ParseInt(playerData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return nil, nil
	}
	currentX, _ := strconv.Atoi(playerData["x"])
	currentY, _ := strconv.Atoi(playerData["y"])
	targetX, targetY := placeData.X, placeData.Y
	if ((currentX-targetX)*(currentX-targetX) + (currentY-targetY)*(currentY-targetY)) != 1 {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
	}
	inventoryKey := "player:inventory:" + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)
	if placeData.Item == "wooden_wall" {
		wallCountStr, err := rdb.HGet(ctx, inventoryKey, "wooden_wall").Result()
		if err != nil {
			return nil, nil
		}
		wallCount, _ := strconv.Atoi(wallCountStr)
		if wallCount < 1 {
			return nil, nil
		}
		tileJSON, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
		if err != nil {
			return nil, nil
		}
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)
		props := TileDefs[tile.Type]
		if !props.IsBuildableOn {
			return nil, nil
		}
		targetTileLockKey := "lock:tile:" + targetCoordKey
		wasSet, err := rdb.SetNX(ctx, targetTileLockKey, "world_object", 0).Result()
		if err != nil || !wasSet {
			return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
		}
		wallProps := TileDefs["wooden_wall"]
		newWallTile := models.WorldTile{Type: "wooden_wall", Health: wallProps.MaxHealth}
		newTileJSON, _ := json.Marshal(newWallTile)
		pipe := rdb.Pipeline()
		newAmount := pipe.HIncrBy(ctx, inventoryKey, "wooden_wall", -1)
		pipe.HSet(ctx, "world:zone:0", targetCoordKey, string(newTileJSON))
		_, err = pipe.Exec(ctx)
		if err != nil {
			rdb.Del(ctx, targetTileLockKey)
			return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
		}
		worldUpdateMsg := models.WorldUpdateMessage{Type: "world_update", X: targetX, Y: targetY, Tile: newWallTile}
		PublishUpdate(worldUpdateMsg)
		inventoryUpdateMsg := &models.InventoryUpdateMessage{Type: "inventory_update", Resource: "wooden_wall", Amount: int(newAmount.Val())}
		rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
		return nil, inventoryUpdateMsg
	}
	return nil, nil
}

// --- THIS FUNCTION IS COMPLETELY REWRITTEN ---
// ProcessCraft handles a player's request to craft an item. It is now generic.
func ProcessCraft(playerID string, payload json.RawMessage) ([]*models.InventoryUpdateMessage, *models.StateCorrectionMessage) {
	var craftData models.CraftPayload
	if err := json.Unmarshal(payload, &craftData); err != nil {
		return nil, nil
	}

	// Check for action cooldown
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return nil, nil
	}
	nextActionAt, _ := strconv.ParseInt(playerData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return nil, nil
	}

	// 1. Look up the recipe from our definitions
	recipe, ok := RecipeDefs[craftData.Item]
	if !ok {
		log.Printf("Player %s tried to craft unknown item: %s", playerID, craftData.Item)
		return nil, nil // Recipe doesn't exist
	}

	inventoryKey := "player:inventory:" + playerID
	var updates []*models.InventoryUpdateMessage

	// 2. Check if the player has all required ingredients
	for ingredient, requiredAmount := range recipe.Ingredients {
		currentAmountStr, err := rdb.HGet(ctx, inventoryKey, ingredient).Result()
		if err != nil {
			currentAmountStr = "0"
		}
		currentAmount, _ := strconv.Atoi(currentAmountStr)

		if currentAmount < requiredAmount {
			log.Printf("Player %s failed to craft %s: not enough %s.", playerID, craftData.Item, ingredient)
			return nil, nil // Not enough of this ingredient
		}
	}

	// 3. Atomically update inventory
	pipe := rdb.Pipeline()
	// Subtract all ingredients
	for ingredient, requiredAmount := range recipe.Ingredients {
		newAmount := pipe.HIncrBy(ctx, inventoryKey, ingredient, int64(-requiredAmount))
		// We need to capture the result in a closure to build the update message later
		updates = append(updates, &models.InventoryUpdateMessage{
			Type: "inventory_update", Resource: ingredient, Amount: int(newAmount.Val()),
		})
	}
	// Add the crafted item(s)
	newCraftedAmount := pipe.HIncrBy(ctx, inventoryKey, craftData.Item, int64(recipe.Yield))
	updates = append(updates, &models.InventoryUpdateMessage{
		Type: "inventory_update", Resource: craftData.Item, Amount: int(newCraftedAmount.Val()),
	})

	// Execute the transaction
	cmders, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Redis error during crafting for player %s: %v", playerID, err)
		return nil, nil
	}

	// 4. Populate the update messages with the actual final values from Redis
	// This is a bit complex, but ensures the client gets the right final amount
	for i, cmder := range cmders {
		if intCmd, ok := cmder.(*redis.IntCmd); ok {
			updates[i].Amount = int(intCmd.Val())
		}
	}

	log.Printf("Player %s successfully crafted %d %s.", playerID, recipe.Yield, craftData.Item)
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	return updates, nil
}

// PublishUpdate sends a message to the Redis world_updates channel for broadcasting.
func PublishUpdate(message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling message for publish: %v", err)
		return
	}
	rdb.Publish(ctx, "world_updates", string(jsonMsg))
}
