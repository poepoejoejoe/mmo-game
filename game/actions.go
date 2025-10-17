package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// ProcessMove handles a player's move request with collision detection and cooldowns.
// It returns a state correction message if the move is invalid, otherwise nil.
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
		return nil // Target tile doesn't exist (out of bounds)
	}
	var tile models.WorldTile
	json.Unmarshal([]byte(tileJSON), &tile)

	// Check for terrain collision
	if tile.Type == "rock" || tile.Type == "tree" || tile.Type == "wooden_wall" {
		return nil
	}

	targetTileKey := "lock:tile:" + targetCoordKey
	wasSet, err := rdb.SetNX(ctx, targetTileKey, playerID, 0).Result()

	if err != nil || !wasSet {
		// Tile is locked by another player, send correction
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}
	}

	cooldown := BaseActionCooldown
	if tile.Type == "water" {
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

// ProcessInteract handles a player's request to gather a resource.
// It returns a correction message on failure or an inventory update on success.
func ProcessInteract(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var interactData models.InteractPayload
	if err := json.Unmarshal(payload, &interactData); err != nil {
		return nil, nil
	}

	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return nil, nil
	}

	// 1. Check Action Cooldown
	nextActionAt, _ := strconv.ParseInt(playerData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return nil, nil
	}

	currentX, _ := strconv.Atoi(playerData["x"])
	currentY, _ := strconv.Atoi(playerData["y"])

	// 2. Check Adjacency
	targetX, targetY := interactData.X, interactData.Y
	if ((currentX-targetX)*(currentX-targetX) + (currentY-targetY)*(currentY-targetY)) != 1 {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
	}

	// 3. Get Tile Data and check if it's interactable
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)
	tileJSON, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
	if err != nil {
		return nil, nil
	}
	var tile models.WorldTile
	json.Unmarshal([]byte(tileJSON), &tile)

	// --- THIS IS THE FIX ---
	// Store the original type before we modify it.
	originalTileType := tile.Type
	// --- END OF FIX ---

	if originalTileType != "tree" && originalTileType != "rock" && originalTileType != "wooden_wall" {
		return nil, nil
	}

	// 4. Process the interaction
	tile.Health--

	damageMsg := models.ResourceDamagedMessage{
		Type: "resource_damaged", X: targetX, Y: targetY, NewHealth: tile.Health,
	}
	PublishUpdate(damageMsg)

	var inventoryUpdateMsg *models.InventoryUpdateMessage

	// 5. Handle resource gain for gathering actions
	if originalTileType == "tree" || originalTileType == "rock" {
		var resourceGained string
		if originalTileType == "tree" {
			resourceGained = "wood"
		}
		if originalTileType == "rock" {
			resourceGained = "rock"
		}

		newAmount, _ := rdb.HIncrBy(ctx, "player:inventory:"+playerID, resourceGained, 1).Result()
		inventoryUpdateMsg = &models.InventoryUpdateMessage{
			Type: "inventory_update", Resource: resourceGained, Amount: int(newAmount),
		}
	}

	// 6. Check if the object is depleted/destroyed
	if tile.Health <= 0 {
		tile.Type = "ground"
		groundTile := models.WorldTile{Type: "ground", Health: 0}
		worldUpdateMsg := models.WorldUpdateMessage{Type: "world_update", X: targetX, Y: targetY, Tile: groundTile}
		PublishUpdate(worldUpdateMsg)

		// --- THIS IS THE FIX ---
		// Now we check the *original* type. If it was a wall, we remove the lock.
		if originalTileType == "wooden_wall" {
			log.Printf("Wall at %s destroyed, removing lock.", targetCoordKey)
			rdb.Del(ctx, "lock:tile:"+targetCoordKey)
		}
		// --- END OF FIX ---
	}

	// 7. Update the world state in Redis
	newTileJSON, _ := json.Marshal(tile)
	rdb.HSet(ctx, "world:zone:0", targetCoordKey, string(newTileJSON))

	// 8. Set Action Cooldown
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	return nil, inventoryUpdateMsg
}

// --- NEW FUNCTION ---
// ProcessCraft handles a player's request to craft an item from resources.
func ProcessCraft(playerID string, payload json.RawMessage) ([]*models.InventoryUpdateMessage, *models.StateCorrectionMessage) {
	var craftData models.CraftPayload
	if err := json.Unmarshal(payload, &craftData); err != nil {
		return nil, nil // Invalid payload
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

	var updates []*models.InventoryUpdateMessage
	inventoryKey := "player:inventory:" + playerID

	// --- Crafting Logic for Wooden Wall ---
	if craftData.Item == "wooden_wall" {
		// 1. Check if player has enough wood
		currentWoodStr, err := rdb.HGet(ctx, inventoryKey, "wood").Result()
		if err != nil {
			currentWoodStr = "0"
		} // If no wood, treat as 0
		currentWood, _ := strconv.Atoi(currentWoodStr)

		if currentWood < WoodPerWall {
			log.Printf("Player %s failed to craft wall: not enough wood.", playerID)
			return nil, nil // Not enough resources
		}

		// 2. Atomically update inventory
		pipe := rdb.Pipeline()
		newWood := pipe.HIncrBy(ctx, inventoryKey, "wood", -WoodPerWall)
		newWalls := pipe.HIncrBy(ctx, inventoryKey, "wooden_wall", 1)
		_, err = pipe.Exec(ctx)
		if err != nil {
			log.Printf("Redis error during crafting for player %s: %v", playerID, err)
			return nil, nil
		}

		// 3. Create inventory update messages to send back to the client
		updates = append(updates, &models.InventoryUpdateMessage{
			Type: "inventory_update", Resource: "wood", Amount: int(newWood.Val()),
		})
		updates = append(updates, &models.InventoryUpdateMessage{
			Type: "inventory_update", Resource: "wooden_wall", Amount: int(newWalls.Val()),
		})

		log.Printf("Player %s crafted a wooden wall.", playerID)
	}

	// Set action cooldown after a successful craft
	if len(updates) > 0 {
		rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	}

	return updates, nil
}

// --- NEW FUNCTION ---
// ProcessPlaceItem handles a player's request to build an item in the world.
func ProcessPlaceItem(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var placeData models.PlaceItemPayload
	if err := json.Unmarshal(payload, &placeData); err != nil {
		return nil, nil
	}

	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return nil, nil
	}

	// 1. Check Action Cooldown
	nextActionAt, _ := strconv.ParseInt(playerData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return nil, nil
	}

	currentX, _ := strconv.Atoi(playerData["x"])
	currentY, _ := strconv.Atoi(playerData["y"])

	// 2. Check Adjacency (must be 1 tile away)
	targetX, targetY := placeData.X, placeData.Y
	distX := (currentX - targetX) * (currentX - targetX)
	distY := (currentY - targetY) * (currentY - targetY)
	if (distX + distY) != 1 {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
	}

	inventoryKey := "player:inventory:" + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	// --- Logic for Wooden Wall ---
	if placeData.Item == "wooden_wall" {
		// 3. Check Inventory
		wallCountStr, err := rdb.HGet(ctx, inventoryKey, "wooden_wall").Result()
		if err != nil {
			return nil, nil
		} // Player has no walls
		wallCount, _ := strconv.Atoi(wallCountStr)
		if wallCount < 1 {
			return nil, nil // Not enough walls
		}

		// 4. Check Target Tile
		tileJSON, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
		if err != nil {
			return nil, nil
		} // Tile doesn't exist
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)

		if tile.Type != "ground" {
			return nil, nil // Can only build on empty ground
		}

		// 5. Try to lock the target tile to ensure it's not occupied
		targetTileLockKey := "lock:tile:" + targetCoordKey
		wasSet, err := rdb.SetNX(ctx, targetTileLockKey, "world_object", 0).Result()
		if err != nil || !wasSet {
			// Failed to lock, tile is occupied by a player.
			return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
		}

		// 6. All checks passed. Execute the build.
		newWallTile := models.WorldTile{Type: "wooden_wall", Health: HealthWall}
		newTileJSON, _ := json.Marshal(newWallTile)

		pipe := rdb.Pipeline()
		// Decrement wall from inventory
		newAmount := pipe.HIncrBy(ctx, inventoryKey, "wooden_wall", -1)
		// Update the world tile
		pipe.HSet(ctx, "world:zone:0", targetCoordKey, string(newTileJSON))
		_, err = pipe.Exec(ctx)
		if err != nil {
			// Rollback the lock if something went wrong
			rdb.Del(ctx, targetTileLockKey)
			return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
		}

		// 7. Broadcast and send inventory update
		worldUpdateMsg := models.WorldUpdateMessage{Type: "world_update", X: targetX, Y: targetY, Tile: newWallTile}
		PublishUpdate(worldUpdateMsg)

		inventoryUpdateMsg := &models.InventoryUpdateMessage{Type: "inventory_update", Resource: "wooden_wall", Amount: int(newAmount.Val())}

		rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
		return nil, inventoryUpdateMsg
	}

	return nil, nil
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
