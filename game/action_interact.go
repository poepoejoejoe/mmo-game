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

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return nil, nil
	}

	currentX, currentY := GetEntityPosition(playerData)

	// --- NEW: Handle Entity Interaction ---
	if interactData.EntityID != "" {
		targetData, err := rdb.HGetAll(ctx, interactData.EntityID).Result()
		if err != nil || len(targetData) == 0 {
			return nil, nil // Invalid target
		}

		entityType := targetData["entityType"]

		// --- NPC Interaction ---
		if entityType == string(EntityTypeNPC) {
			targetX, _ := strconv.Atoi(targetData["x"])
			targetY, _ := strconv.Atoi(targetData["y"])
			UpdateEntityDirection(playerID, targetX, targetY)

			npcType := NPCType(targetData["npcType"])
			if npcType == NPCTypeWizard {
				dialog := GetWizardDialog(playerID)
				dialogJSON, _ := json.Marshal(dialog)
				sendDirectMessage(playerID, dialogJSON)
			}
			return nil, nil // End interaction after talking
		}

		// --- Item Pickup ---
		if entityType == string(EntityTypeItem) {
			targetX, _ := strconv.Atoi(targetData["x"])
			targetY, _ := strconv.Atoi(targetData["y"])

			if !IsWithinPickupRange(currentX, currentY, targetX, targetY) {
				return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
			}

			owner := targetData["owner"]
			publicAt, _ := strconv.ParseInt(targetData["publicAt"], 10, 64)

			isPublic := owner == "" || (publicAt > 0 && time.Now().UnixMilli() >= publicAt)
			if owner == playerID || isPublic {
				itemID := ItemID(targetData["itemId"])
				quantity, _ := strconv.Atoi(targetData["quantity"])

				newInventory, err := AddItemToInventory(playerID, itemID, quantity)
				if err != nil {
					log.Printf("could not add item to inventory: %v", err)
					return nil, nil
				}

				// Remove item from world
				CleanupEntity(interactData.EntityID, targetData)

				inventoryUpdateMsg := &models.InventoryUpdateMessage{
					Type:      string(ServerEventInventoryUpdate),
					Inventory: newInventory,
				}
				rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
				return nil, inventoryUpdateMsg
			} else {
				// Player cannot pick up the item, send a notification.
				notification := models.NotificationMessage{
					Type:    string(ServerEventNotification),
					Message: "You cannot pick up this item yet.",
				}
				PublishPrivately(playerID, notification)
			}
		}
	}

	// --- Existing Resource Interaction ---
	targetX, targetY := interactData.X, interactData.Y

	if !IsAdjacentOrDiagonal(currentX, currentY, targetX, targetY) {
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
	}

	tile, props, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return nil, nil
	}
	originalTileType := tile.Type

	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	if TileType(tile.Type) == TileTypeSanctuaryStone {
		dialog := models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Alter Binding?",
			Text:    "Do you want to change your binding to this Sanctuary Stone? Your binding determines where you can teleport to and where you will respawn if you die.",
			Options: []models.DialogOption{
				{Text: "Yes", Action: "set_binding", Context: targetCoordKey},
				{Text: "No", Action: "close_dialog"},
			},
		}
		dialogJSON, _ := json.Marshal(dialog)
		sendDirectMessage(playerID, dialogJSON)
		return nil, nil
	}

	if !props.IsGatherable && !props.IsDestructible {
		return nil, nil
	}

	UpdateEntityDirection(playerID, targetX, targetY)

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
			if props.GatherSkill != "" && props.GatherXP > 0 {
				AddExperience(playerID, props.GatherSkill, props.GatherXP)
			}

			// --- NEW: Quest Completion Check for Gathering ---
			CheckObjectives(playerID, models.ObjectiveGather, string(props.GatherResource))
			// --- END NEW ---
		}
	}

	if tile.Health <= 0 {
		groundTile := models.WorldTile{Type: string(TileTypeGround), Health: 0}
		worldUpdateMsg := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate),
			X:    targetX,
			Y:    targetY,
			Tile: groundTile,
		}
		PublishUpdate(worldUpdateMsg)

		if props.IsGatherable {
			member := originalTileType + ":" + targetCoordKey
			rdb.ZRem(ctx, string(RedisKeyResourcePositions), member)
		}

		if TileType(originalTileType) == TileTypeWoodenWall {
			log.Printf("Wall at %s destroyed, removing lock.", targetCoordKey)
			rdb.Del(ctx, string(RedisKeyLockTile)+targetCoordKey)
		}

		newTileJSON, _ := json.Marshal(groundTile)
		rdb.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
	} else {
		newTileJSON, _ := json.Marshal(tile)
		rdb.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
	}

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

	if !IsAdjacentOrDiagonal(currentX, currentY, targetX, targetY) {
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
	}

	targetTile, _, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return nil, nil // Or handle error appropriately
	}
	if targetTile.IsSanctuary {
		notification := models.NotificationMessage{
			Type:    string(ServerEventNotification),
			Message: "You cannot build on sanctuary tiles.",
		}
		PublishPrivately(playerID, notification)
		return nil, nil
	}

	switch ItemID(placeData.Item) {
	case ItemWoodenWall:
		return handlePlaceWoodenWall(playerID, currentX, currentY, targetX, targetY)
	case ItemFire:
		return handlePlaceFire(playerID, currentX, currentY, targetX, targetY)
	}

	// Default case if item is not placeable or recognized
	return nil, nil
}

func handlePlaceWoodenWall(playerID string, currentX, currentY, targetX, targetY int) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, nil
	}

	wallSlot, wallItem, found := findItemInInventory(inventoryDataRaw, ItemWoodenWall)
	if !found || wallItem.Quantity < 1 {
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

	// --- NEW: Quest Completion Check ---
	CheckObjectives(playerID, models.ObjectivePlace, string(ItemWoodenWall))
	// --- END NEW ---

	inventoryUpdateMsg := getInventoryUpdateMessage(inventoryKey)
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	return nil, inventoryUpdateMsg
}

func handlePlaceFire(playerID string, currentX, currentY, targetX, targetY int) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	currentTile, props, err := GetWorldTile(targetX, targetY)
	if err != nil || !props.IsBuildableOn {
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
	}

	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, nil
	}

	fireSlot, fireItem, found := findItemInInventory(inventoryDataRaw, ItemFire)
	if !found {
		return nil, nil
	}

	pipe := rdb.Pipeline()
	fireItem.Quantity--
	if fireItem.Quantity > 0 {
		itemJSON, _ := json.Marshal(fireItem)
		pipe.HSet(ctx, inventoryKey, fireSlot, string(itemJSON))
	} else {
		pipe.HSet(ctx, inventoryKey, fireSlot, "")
	}

	currentTile.Type = string(TileTypeFire)
	newTileJSON, _ := json.Marshal(currentTile)
	pipe.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
	_, err = pipe.Exec(ctx)
	if err != nil {
		return nil, nil
	}

	worldUpdate := models.WorldUpdateMessage{
		Type: string(ServerEventWorldUpdate),
		X:    targetX,
		Y:    targetY,
		Tile: *currentTile,
	}
	PublishUpdate(worldUpdate)

	inventoryUpdateMsg := getInventoryUpdateMessage(inventoryKey)

	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	scheduleFireExpiration(targetX, targetY)
	return nil, inventoryUpdateMsg
}

func scheduleFireExpiration(x, y int) {
	fireProps := TileDefs[TileTypeFire]
	time.AfterFunc(time.Duration(fireProps.Duration)*time.Millisecond, func() {
		expireFire(x, y)
	})
}

func expireFire(x, y int) {
	coordKey := strconv.Itoa(x) + "," + strconv.Itoa(y)
	tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), coordKey).Result()
	if err != nil {
		return
	}

	var tile models.WorldTile
	if err := json.Unmarshal([]byte(tileJSON), &tile); err != nil {
		log.Printf("Failed to unmarshal tile at %s: %v", coordKey, err)
		return
	}

	if TileType(tile.Type) == TileTypeFire {
		tile.Type = string(TileTypeGround)
		newTileJSON, _ := json.Marshal(tile)
		rdb.HSet(ctx, string(RedisKeyWorldZone0), coordKey, string(newTileJSON))

		worldUpdate := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate),
			X:    x,
			Y:    y,
			Tile: tile,
		}
		PublishUpdate(worldUpdate)
	}
}

func findItemInInventory(inventoryDataRaw map[string]string, itemID ItemID) (string, models.Item, bool) {
	for i := 0; i < 10; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
			var item models.Item
			if err := json.Unmarshal([]byte(itemJSON), &item); err == nil {
				if item.ID == string(itemID) {
					return slotKey, item, true
				}
			}
		}
	}
	return "", models.Item{}, false
}

func getInventoryUpdateMessage(inventoryKey string) *models.InventoryUpdateMessage {
	newInventoryDataRaw, _ := rdb.HGetAll(ctx, inventoryKey).Result()
	newInventory := make(map[string]models.Item)
	for slot, itemJSON := range newInventoryDataRaw {
		if itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			newInventory[slot] = item
		}
	}

	return &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: newInventory,
	}
}
