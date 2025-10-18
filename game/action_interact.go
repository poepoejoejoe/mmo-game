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

	// Use new generic helper
	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return nil, nil
	}

	// Use new generic helper
	currentX, currentY := GetEntityPosition(playerData)
	targetX, targetY := interactData.X, interactData.Y

	if !IsAdjacent(currentX, currentY, targetX, targetY) {
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
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
		Type:      string(ServerEventResourceDamaged), // Use ServerEventType constant
		X:         targetX,
		Y:         targetY,
		NewHealth: tile.Health,
	}
	PublishUpdate(damageMsg)

	var inventoryUpdateMsg *models.InventoryUpdateMessage
	if props.IsGatherable {
		// Use RedisKey and ItemType constants
		newAmount, _ := rdb.HIncrBy(ctx, string(RedisKeyPlayerInventory)+playerID, string(props.GatherResource), 1).Result()
		inventoryUpdateMsg = &models.InventoryUpdateMessage{
			Type:     string(ServerEventInventoryUpdate), // Use ServerEventType constant
			Resource: string(props.GatherResource),       // Cast ItemType to string
			Amount:   int(newAmount),
		}
	}

	if tile.Health <= 0 {
		// Use TileType constant
		tile.Type = string(TileTypeGround)
		groundTile := models.WorldTile{Type: string(TileTypeGround), Health: 0}
		worldUpdateMsg := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate), // Use ServerEventType constant
			X:    targetX,
			Y:    targetY,
			Tile: groundTile,
		}
		PublishUpdate(worldUpdateMsg)

		// Use TileType constant
		if TileType(originalTileType) == TileTypeWoodenWall {
			log.Printf("Wall at %s destroyed, removing lock.", targetCoordKey)
			// Use RedisKey constant
			rdb.Del(ctx, string(RedisKeyLockTile)+targetCoordKey)
		}
	}

	newTileJSON, _ := json.Marshal(tile)
	// Use RedisKey constant
	rdb.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	return nil, inventoryUpdateMsg
}

func ProcessPlaceItem(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var placeData models.PlaceItemPayload
	if err := json.Unmarshal(payload, &placeData); err != nil {
		return nil, nil
	}

	// Use new generic helper
	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return nil, nil
	}

	// Use new generic helper
	currentX, currentY := GetEntityPosition(playerData)
	targetX, targetY := placeData.X, placeData.Y

	if !IsAdjacent(currentX, currentY, targetX, targetY) {
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
	}

	// Use RedisKey constant
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	// Use ItemType constant
	if ItemType(placeData.Item) == ItemWoodenWall {
		// Use ItemType constant
		wallCountStr, err := rdb.HGet(ctx, inventoryKey, string(ItemWoodenWall)).Result()
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

		// Use RedisKey constants
		targetTileLockKey := string(RedisKeyLockTile) + targetCoordKey
		wasSet, err := rdb.SetNX(ctx, targetTileLockKey, string(RedisKeyLockWorldObject), 0).Result()
		if err != nil || !wasSet {
			// Use ServerEventType constant
			return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
		}

		// Use TileType constant
		wallProps := TileDefs[TileTypeWoodenWall]
		newWallTile := models.WorldTile{Type: string(TileTypeWoodenWall), Health: wallProps.MaxHealth}
		newTileJSON, _ := json.Marshal(newWallTile)

		pipe := rdb.Pipeline()
		// Use ItemType and RedisKey constants
		newAmount := pipe.HIncrBy(ctx, inventoryKey, string(ItemWoodenWall), -1)
		pipe.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
		_, err = pipe.Exec(ctx)
		if err != nil {
			rdb.Del(ctx, targetTileLockKey)
			// Use ServerEventType constant
			return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
		}

		worldUpdateMsg := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate), // Use ServerEventType constant
			X:    targetX,
			Y:    targetY,
			Tile: newWallTile,
		}
		PublishUpdate(worldUpdateMsg)

		// Use ServerEventType and ItemType constants
		inventoryUpdateMsg := &models.InventoryUpdateMessage{
			Type:     string(ServerEventInventoryUpdate),
			Resource: string(ItemWoodenWall),
			Amount:   int(newAmount.Val()),
		}
		rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
		return nil, inventoryUpdateMsg
	}
	return nil, nil
}
