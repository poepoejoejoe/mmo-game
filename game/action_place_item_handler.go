package game

import (
	"encoding/json"
	"mmo-game/game/utils"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// PlaceItemActionHandler handles client place item actions.
// This implements the ActionHandler interface for standardized action processing.
type PlaceItemActionHandler struct{}

// Process handles a place item action request from the client.
// It places items like wooden walls or fire into the world, consuming inventory items.
func (h *PlaceItemActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var placeData models.PlaceItemPayload
	if err := json.Unmarshal(payload, &placeData); err != nil {
		return Failed()
	}

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	currentX, currentY := GetEntityPosition(playerData)
	targetX, targetY := placeData.X, placeData.Y

	if !IsAdjacentOrDiagonal(currentX, currentY, targetX, targetY) {
		result := NewActionResult()
		correctionMsg := CreateStateCorrectionMessage(currentX, currentY)
		result.AddToPlayer(correctionMsg)
		return result
	}

	targetTile, _, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return Failed()
	}
	if targetTile.IsSanctuary {
		notification := CreateNotificationMessage("You cannot build on sanctuary tiles.")
		SendPrivately(playerID, notification)
		return Failed()
	}

	// Route to appropriate handler based on item type
	switch ItemID(placeData.Item) {
	case ItemWoodenWall:
		return h.handlePlaceWoodenWall(playerID, currentX, currentY, targetX, targetY)
	case ItemFire:
		return h.handlePlaceFire(playerID, currentX, currentY, targetX, targetY)
	default:
		// Item is not placeable
		return Failed()
	}
}

// handlePlaceWoodenWall handles placing a wooden wall item.
func (h *PlaceItemActionHandler) handlePlaceWoodenWall(playerID string, currentX, currentY, targetX, targetY int) *ActionResult {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return Failed()
	}

	wallSlot, wallItem, found := findItemInInventory(inventoryDataRaw, ItemWoodenWall)
	if !found || wallItem.Quantity < 1 {
		return Failed()
	}

	_, props, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return Failed()
	}
	if !props.IsBuildableOn {
		return Failed()
	}

	targetTileLockKey := string(RedisKeyLockTile) + targetCoordKey
	wasSet, err := rdb.SetNX(ctx, targetTileLockKey, string(RedisKeyLockWorldObject), 0).Result()
	if err != nil || !wasSet {
		result := NewActionResult()
		correctionMsg := CreateStateCorrectionMessage(currentX, currentY)
		result.AddToPlayer(correctionMsg)
		return result
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
		pipe.HSet(ctx, inventoryKey, wallSlot, "")
	}

	pipe.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
	pipe.SAdd(ctx, string(RedisKeyActiveDecay), targetCoordKey)
	_, err = pipe.Exec(ctx)
	if err != nil {
		rdb.Del(ctx, targetTileLockKey)
		result := NewActionResult()
		correctionMsg := CreateStateCorrectionMessage(currentX, currentY)
		result.AddToPlayer(correctionMsg)
		return result
	}

	worldUpdateMsg := models.WorldUpdateMessage{
		Type: string(ServerEventWorldUpdate),
		X:    targetX,
		Y:    targetY,
		Tile: newWallTile,
	}
	Broadcast(worldUpdateMsg)

	CheckObjectives(playerID, models.ObjectivePlace, string(ItemWoodenWall))

	inventoryUpdateMsg := getInventoryUpdateMessage(inventoryKey)
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	result := NewActionResult()
	if inventoryUpdateMsg != nil {
		inventoryJSON, _ := json.Marshal(inventoryUpdateMsg)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    inventoryUpdateMsg.Type,
			Payload: inventoryJSON,
		})
	}
	return result
}

// handlePlaceFire handles placing a fire item.
func (h *PlaceItemActionHandler) handlePlaceFire(playerID string, currentX, currentY, targetX, targetY int) *ActionResult {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	currentTile, props, err := GetWorldTile(targetX, targetY)
	if err != nil || !props.IsBuildableOn {
		result := NewActionResult()
		correctionMsg := CreateStateCorrectionMessage(currentX, currentY)
		result.AddToPlayer(correctionMsg)
		return result
	}

	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return Failed()
	}

	fireSlot, fireItem, found := findItemInInventory(inventoryDataRaw, ItemFire)
	if !found {
		return Failed()
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
		return Failed()
	}

	worldUpdate := models.WorldUpdateMessage{
		Type: string(ServerEventWorldUpdate),
		X:    targetX,
		Y:    targetY,
		Tile: *currentTile,
	}
	Broadcast(worldUpdate)

	// Add the fire to the resource positions set so the damage system can find it
	member := string(TileTypeFire) + ":" + targetCoordKey
	x, y := utils.ParseCoordKey(targetCoordKey)

	// Update the resource's geo-position
	lon, lat := NormalizeCoords(x, y)
	rdb.GeoAdd(ctx, string(RedisKeyResourcePositions), &redis.GeoLocation{
		Name:      member,
		Longitude: lon,
		Latitude:  lat,
	})

	inventoryUpdateMsg := getInventoryUpdateMessage(inventoryKey)
	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
	scheduleFireExpiration(targetX, targetY)

	result := NewActionResult()
	if inventoryUpdateMsg != nil {
		inventoryJSON, _ := json.Marshal(inventoryUpdateMsg)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    inventoryUpdateMsg.Type,
			Payload: inventoryJSON,
		})
	}
	return result
}

