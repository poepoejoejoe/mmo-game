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
		newInventory, err := AddItemToInventory(playerID, props.GatherResource, 1)
		if err == nil {
			inventoryUpdateMsg = &models.InventoryUpdateMessage{
				Type:      string(ServerEventInventoryUpdate),
				Inventory: newInventory,
			}
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

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return nil, nil
	}

	currentX, currentY := GetEntityPosition(playerData)
	targetX, targetY := placeData.X, placeData.Y

	if !IsAdjacent(currentX, currentY, targetX, targetY) {
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	if ItemID(placeData.Item) == ItemWoodenWall {
		inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
		if err != nil {
			return nil, nil
		}

		var wallSlot string
		var wallItem models.Item
		for i := 0; i < 10; i++ {
			slotKey := "slot_" + strconv.Itoa(i)
			if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
				var item models.Item
				json.Unmarshal([]byte(itemJSON), &item)
				if item.ID == string(ItemWoodenWall) {
					wallSlot = slotKey
					wallItem = item
					break
				}
			}
		}

		if wallSlot == "" || wallItem.Quantity < 1 {
			return nil, nil
		}

		_, props, err := GetWorldTile(targetX, targetY)
		if err != nil {
			return nil, nil
		}
		if !props.IsBuildableOn {
			return nil, nil
		}

		targetTileLockKey := string(RedisKeyLockTile) + targetCoordKey
		wasSet, err := rdb.SetNX(ctx, targetTileLockKey, string(RedisKeyLockWorldObject), 0).Result()
		if err != nil || !wasSet {
			return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
		}

		wallProps := TileDefs[TileTypeWoodenWall]
		newWallTile := models.WorldTile{Type: string(TileTypeWoodenWall), Health: wallProps.MaxHealth}
		newTileJSON, _ := json.Marshal(newWallTile)

		pipe := rdb.Pipeline()

		wallItem.Quantity--
		if wallItem.Quantity > 0 {
			newItemJSON, _ := json.Marshal(wallItem)
			pipe.HSet(ctx, inventoryKey, wallSlot, string(newItemJSON))
		} else {
			pipe.HSet(ctx, inventoryKey, wallSlot, "") // Clear the slot
		}

		pipe.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
		_, err = pipe.Exec(ctx)
		if err != nil {
			rdb.Del(ctx, targetTileLockKey)
			return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
		}

		worldUpdateMsg := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate),
			X:    targetX,
			Y:    targetY,
			Tile: newWallTile,
		}
		PublishUpdate(worldUpdateMsg)

		// Refetch the entire inventory to send the update
		newInventoryDataRaw, _ := rdb.HGetAll(ctx, inventoryKey).Result()
		newInventory := make(map[string]models.Item)
		for slot, itemJSON := range newInventoryDataRaw {
			if itemJSON != "" {
				var item models.Item
				json.Unmarshal([]byte(itemJSON), &item)
				newInventory[slot] = item
			}
		}

		inventoryUpdateMsg := &models.InventoryUpdateMessage{
			Type:      string(ServerEventInventoryUpdate),
			Inventory: newInventory,
		}
		rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
		return nil, inventoryUpdateMsg
	}
	return nil, nil
}
