package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"
)

func ProcessInteract(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var interactData models.InteractPayload
	if err := json.Unmarshal(payload, &interactData); err != nil {
		return nil, nil
	}

	canAct, playerData := CanPlayerAct(playerID)
	if !canAct {
		return nil, nil
	}

	currentX, currentY := GetPlayerPosition(playerData)
	targetX, targetY := interactData.X, interactData.Y

	if !IsAdjacent(currentX, currentY, targetX, targetY) {
		return &models.StateCorrectionMessage{Type: "state_correction", X: currentX, Y: currentY}, nil
	}

	tile, props, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return nil, nil
	}
	originalTileType := tile.Type

	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

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
			// Now this line will work correctly
			rdb.Del(ctx, "lock:tile:"+targetCoordKey)
		}
	}

	newTileJSON, _ := json.Marshal(tile)
	rdb.HSet(ctx, "world:zone:0", targetCoordKey, string(newTileJSON))
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	return nil, inventoryUpdateMsg
}

func ProcessPlaceItem(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var placeData models.PlaceItemPayload
	if err := json.Unmarshal(payload, &placeData); err != nil {
		return nil, nil
	}

	canAct, playerData := CanPlayerAct(playerID)
	if !canAct {
		return nil, nil
	}

	currentX, currentY := GetPlayerPosition(playerData)
	targetX, targetY := placeData.X, placeData.Y

	if !IsAdjacent(currentX, currentY, targetX, targetY) {
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

		_, props, err := GetWorldTile(targetX, targetY)
		if err != nil {
			return nil, nil
		}
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
