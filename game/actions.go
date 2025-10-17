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
	terrainType, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
	if err != nil || terrainType == "rock" || terrainType == "tree" {
		return nil
	}

	targetTileKey := "lock:tile:" + targetCoordKey
	wasSet, err := rdb.SetNX(ctx, targetTileKey, playerID, 0).Result()

	if err != nil || !wasSet {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}
	}

	cooldown := BaseActionCooldown
	if terrainType == "water" {
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
	distX := (currentX - targetX) * (currentX - targetX)
	distY := (currentY - targetY) * (currentY - targetY)
	if (distX + distY) != 1 {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
	}

	// 3. Check Resource Type
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)
	terrainType, err := rdb.HGet(ctx, "world:zone:0", targetCoordKey).Result()
	if err != nil || (terrainType != "tree" && terrainType != "rock") {
		return nil, nil
	}

	// 4. Process Gathering by decrementing health
	healthKey := "world:health:zone:0"
	newHealth, err := rdb.HIncrBy(ctx, healthKey, targetCoordKey, -1).Result()
	if err != nil {
		return nil, nil
	}

	var resourceGained string
	if terrainType == "tree" {
		resourceGained = "wood"
	}
	if terrainType == "rock" {
		resourceGained = "rock"
	}

	// 5. Check if Resource is Depleted
	if newHealth <= 0 {
		pipe := rdb.Pipeline()
		pipe.HSet(ctx, "world:zone:0", targetCoordKey, "ground")
		pipe.HDel(ctx, healthKey, targetCoordKey)
		pipe.Exec(ctx)

		worldUpdateMsg := models.WorldUpdateMessage{
			Type: "world_update",
			X:    targetX,
			Y:    targetY,
			Tile: "ground",
		}
		PublishUpdate(worldUpdateMsg)
	}

	// 6. Add to Inventory
	inventoryKey := "player:inventory:" + playerID
	newAmount, _ := rdb.HIncrBy(ctx, inventoryKey, resourceGained, 1).Result()

	inventoryUpdateMsg := &models.InventoryUpdateMessage{
		Type:     "inventory_update",
		Resource: resourceGained,
		Amount:   int(newAmount),
	}

	// 7. Set Action Cooldown
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	// On success, return the inventory update message and no correction
	return nil, inventoryUpdateMsg
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
