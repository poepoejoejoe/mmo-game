package game

import (
	"encoding/json"
	"fmt"
	"log"
	"mmo-game/models"
	"mmo-game/game/utils"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// --- RENAMED ---
// CanEntityAct checks if an entity is off cooldown and returns their data.
// It fetches entity data and checks their 'nextActionAt' timestamp.
func CanEntityAct(entityID string) (bool, map[string]string) {
	entityData, err := rdb.HGetAll(ctx, entityID).Result()
	if err != nil {
		log.Printf("Failed to get entity data for %s: %v", entityID, err)
		return false, nil
	}

	if healthStr, ok := entityData["health"]; ok {
		health, _ := strconv.Atoi(healthStr)
		if health <= 0 {
			return false, entityData
		}
	}

	nextActionAt, _ := strconv.ParseInt(entityData["nextActionAt"], 10, 64)
	if time.Now().UnixMilli() < nextActionAt {
		return false, entityData // On cooldown
	}

	return true, entityData
}

// --- RENAMED ---
// GetEntityPosition parses X and Y coordinates from entity data.
func GetEntityPosition(playerData map[string]string) (int, int) {
	x, _ := strconv.Atoi(playerData["x"])
	y, _ := strconv.Atoi(playerData["y"])
	return x, y
}

// AddItemToInventory finds the best slot for a new item and adds it.
func AddItemToInventory(playerID string, itemID ItemID, quantity int) (map[string]models.Item, error) {
	inventoryKey := "inventory:" + playerID
	inventoryData, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, err
	}

	pipe := rdb.Pipeline()
	_, newInventory, err := addItemToPlayerInventory(pipe, inventoryKey, inventoryData, itemID, quantity)
	if err != nil {
		return nil, err
	}
	_, err = pipe.Exec(ctx)
	if err != nil {
		return nil, err
	}
	return newInventory, nil

}

func addItemToPlayerInventory(pipe redis.Pipeliner, inventoryKey string, inventoryData map[string]string, itemID ItemID, quantity int) (redis.Pipeliner, map[string]models.Item, error) {
	itemProps := ItemDefs[itemID]
	remainingQuantity := quantity

	// 1. Fill up existing, partially-filled stacks of the same item.
	if itemProps.Stackable {
		for i := 0; i < InventorySize && remainingQuantity > 0; i++ {
			slotKey := "slot_" + strconv.Itoa(i)
			if itemJSON, ok := inventoryData[slotKey]; ok && itemJSON != "" {
				var item models.Item
				json.Unmarshal([]byte(itemJSON), &item)

				if item.ID == string(itemID) && item.Quantity < itemProps.MaxStack {
					spaceInStack := itemProps.MaxStack - item.Quantity
					amountToStack := utils.Min(remainingQuantity, spaceInStack)

					item.Quantity += amountToStack
					remainingQuantity -= amountToStack

					newItemJSON, _ := json.Marshal(item)
					pipe.HSet(ctx, inventoryKey, slotKey, string(newItemJSON))
					inventoryData[slotKey] = string(newItemJSON) // Update local map
				}
			}
		}
	}

	// 2. Add remaining items to new stacks in empty slots.
	if remainingQuantity > 0 {
		for i := 0; i < InventorySize && remainingQuantity > 0; i++ {
			slotKey := "slot_" + strconv.Itoa(i)
			if val, ok := inventoryData[slotKey]; !ok || val == "" {
				amountToPlace := utils.Min(remainingQuantity, itemProps.MaxStack)

				newItem := models.Item{ID: string(itemID), Quantity: amountToPlace}
				newItemJSON, _ := json.Marshal(newItem)
				pipe.HSet(ctx, inventoryKey, slotKey, string(newItemJSON))
				inventoryData[slotKey] = string(newItemJSON) // Update local map

				remainingQuantity -= amountToPlace
			}
		}
	}

	if remainingQuantity > 0 {
		return nil, nil, fmt.Errorf("inventory full")
	}

	newInventory := make(map[string]models.Item)
	for slot, itemJSON := range inventoryData {
		if itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			newInventory[slot] = item
		}
	}

	return pipe, newInventory, nil
}

func RemoveItemFromInventory(playerID string, itemID ItemID, quantity int) (map[string]models.Item, error) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, err
	}

	inventory := make(map[string]models.Item)
	slots := make(map[string]*models.Item)

	// Deserialize inventory
	for i := 0; i < InventorySize; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if itemJSON, ok := inventoryDataRaw[slotKey]; ok && itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			inventory[slotKey] = item
			slots[slotKey] = &item
		}
	}

	remainingToRemove := quantity

	// Find and remove items
	for _, item := range slots {
		if item != nil && item.ID == string(itemID) {
			removeAmount := min(remainingToRemove, item.Quantity)
			item.Quantity -= removeAmount
			remainingToRemove -= removeAmount

			if remainingToRemove == 0 {
				break
			}
		}
	}

	// Update Redis and build the final inventory map
	pipe := rdb.Pipeline()
	finalInventory := make(map[string]models.Item)
	for i := 0; i < InventorySize; i++ {
		slotKey := "slot_" + strconv.Itoa(i)
		if item, ok := slots[slotKey]; ok && item != nil {
			if item.Quantity > 0 {
				itemJSON, _ := json.Marshal(*item)
				pipe.HSet(ctx, inventoryKey, slotKey, string(itemJSON))
				finalInventory[slotKey] = *item
			} else {
				pipe.HSet(ctx, inventoryKey, slotKey, "")
			}
		}
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		return nil, err
	}

	return finalInventory, nil
}

func HasItemInInventory(playerID string, itemID ItemID, quantity int) bool {
	inventory, err := GetInventory(playerID)
	if err != nil {
		return false
	}

	total := 0
	for _, item := range inventory {
		if item.ID == string(itemID) {
			total += item.Quantity
		}
	}
	return total >= quantity
}

// IsAdjacent checks if (x1, y1) is cardinally adjacent to (x2, y2).
func IsAdjacent(x1, y1, x2, y2 int) bool {
	dx := (x1 - x2)
	dy := (y1 - y2)
	distSq := (dx * dx) + (dy * dy)
	return distSq == 1
}

func IsAdjacentOrDiagonal(x1, y1, x2, y2 int) bool {
	dx := x1 - x2
	if dx < 0 {
		dx = -dx
	}
	dy := y1 - y2
	if dy < 0 {
		dy = -dy
	}
	return dx <= 1 && dy <= 1 && (dx != 0 || dy != 0)
}

func IsWithinPickupRange(x1, y1, x2, y2 int) bool {
	dx := x1 - x2
	if dx < 0 {
		dx = -dx
	}
	dy := y1 - y2
	if dy < 0 {
		dy = -dy
	}
	return dx <= 1 && dy <= 1
}

// GetEntitiesInRange uses Redis geospatial queries to find entities of a certain type
// within a given tile radius of a central point (x, y).
func GetEntitiesInRange(x, y, radius int, entityType EntityType) []string {
	// Use the geo key for the correct zone (hardcoded to zone 0 for now)
	geoKey := string(RedisKeyZone0Positions)

	// Perform the search
	locations, err := rdb.GeoRadius(ctx, geoKey, float64(x), float64(y), &redis.GeoRadiusQuery{
		Radius:    TilesToKilometers(radius), // Convert tile radius to km
		Unit:      "km",
		WithDist:  false,
		WithCoord: false,
		Count:     0,     // Get all matches
		Sort:      "ASC", // Sort by distance
	}).Result()

	if err != nil {
		log.Printf("Error performing GeoRadius search: %v", err)
		return []string{}
	}

	// Filter the results by entity type
	var entityIDs []string
	for _, location := range locations {
		// The entity type is part of the key name (e.g., "player:uuid")
		if EntityType(location.Name[0:len(entityType)]) == entityType {
			entityIDs = append(entityIDs, location.Name)
		}
	}

	return entityIDs
}

// PublishUpdate sends a message to the Redis world_updates channel for broadcasting.
func PublishUpdate(message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling message for publish: %v", err)
		return
	}
	// Use Redis topic constant (if you add one, e.g., "world_updates")
	rdb.Publish(ctx, "world_updates", string(jsonMsg))
}

// PublishToPlayer sends a message to a single player via the main Redis pub/sub channel.
// The hub is responsible for decoding this and routing it to the correct client.
func PublishToPlayer(playerID string, message []byte) {
	wrappedMessage := map[string]interface{}{
		"__private_message": true,
		"targetId":          playerID,
		"payload":           json.RawMessage(message),
	}
	PublishUpdate(wrappedMessage)
}

// PublishPrivately sends a message to a single player.
func PublishPrivately(playerID string, message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling private message for publish: %v", err)
		return
	}
	PublishToPlayer(playerID, jsonMsg)
}

// TilesToKilometers converts a distance in game tiles to the approximate
// kilometer equivalent for use in Redis Geo queries.
func TilesToKilometers(tiles int) float64 {
	return float64(tiles) * KILOMETERS_PER_DEGREE
}

func GetInventory(playerID string) (map[string]models.Item, error) {
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	inventoryDataRaw, err := rdb.HGetAll(ctx, inventoryKey).Result()
	if err != nil {
		return nil, err
	}
	inventoryDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range inventoryDataRaw {
		if itemJSON == "" {
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		inventoryDataTyped[slot] = item
	}
	return inventoryDataTyped, nil
}

func GetGear(playerID string) (map[string]models.Item, error) {
	gearKey := string(RedisKeyPlayerGear) + playerID
	gearDataRaw, err := rdb.HGetAll(ctx, gearKey).Result()
	if err != nil {
		return nil, err
	}
	gearDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range gearDataRaw {
		if itemJSON == "" {
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		gearDataTyped[slot] = item
	}
	return gearDataTyped, nil
}

func GetBank(playerID string) (map[string]models.Item, error) {
	bankKey := "bank:" + playerID
	bankDataRaw, err := rdb.HGetAll(ctx, bankKey).Result()
	if err != nil {
		return nil, err
	}
	bankDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range bankDataRaw {
		if itemJSON == "" {
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		bankDataTyped[slot] = item
	}
	return bankDataTyped, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func UpdateEntityDirection(entityID string, targetX int, targetY int) {
	_, entityData := CanEntityAct(entityID)
	currentX, currentY := GetEntityPosition(entityData)

	dx := targetX - currentX
	dy := targetY - currentY

	var direction MoveDirection
	if Abs(dx) > Abs(dy) {
		if dx > 0 {
			direction = MoveDirectionRight
		} else {
			direction = MoveDirectionLeft
		}
	} else {
		if dy > 0 {
			direction = MoveDirectionDown
		} else {
			direction = MoveDirectionUp
		}
	}
	rdb.HSet(ctx, entityID, "direction", string(direction))
	updateMsg := map[string]interface{}{
		"type":      string(ServerEventEntityMoved),
		"entityId":  entityID,
		"x":         currentX,
		"y":         currentY,
		"direction": string(direction),
	}
	PublishUpdate(updateMsg)
}

func Abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func interruptTeleport(playerID string) {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return
	}

	if _, ok := playerData["teleportingUntil"]; ok {
		rdb.HDel(ctx, playerID, "teleportingUntil")

		// Notify client that channel is over
		channelEndMsg := map[string]interface{}{"type": string(ServerEventTeleportChannelEnd)}
		msgJSON, _ := json.Marshal(channelEndMsg)
		sendDirectMessage(playerID, msgJSON)

		sendNotification(playerID, "Your teleport was interrupted!")
		log.Printf("Player %s teleport was interrupted.", playerID)
	}
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

func getBankUpdateMessage(bankKey string) *models.BankUpdateMessage {
	newBankDataRaw, _ := rdb.HGetAll(ctx, bankKey).Result()
	newBank := make(map[string]models.Item)
	for slot, itemJSON := range newBankDataRaw {
		if itemJSON != "" {
			var item models.Item
			json.Unmarshal([]byte(itemJSON), &item)
			newBank[slot] = item
		}
	}

	return &models.BankUpdateMessage{
		Type: string(ServerEventBankUpdate),
		Bank: newBank,
	}
}

// findItemInInventory searches for an item in raw inventory data and returns the slot key, item, and whether it was found.
func findItemInInventory(inventoryDataRaw map[string]string, itemID ItemID) (string, models.Item, bool) {
	for i := 0; i < InventorySize; i++ {
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

// scheduleFireExpiration schedules a fire to expire after its duration.
func scheduleFireExpiration(x, y int) {
	fireProps := TileDefs[TileTypeFire]
	time.AfterFunc(time.Duration(fireProps.Duration)*time.Millisecond, func() {
		expireFire(x, y)
	})
}

// expireFire removes a fire tile and updates the world.
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

		// Remove the fire from the resource positions set
		member := string(TileTypeFire) + ":" + coordKey
		rdb.ZRem(ctx, string(RedisKeyResourcePositions), member)

		worldUpdate := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate),
			X:    x,
			Y:    y,
			Tile: tile,
		}
		PublishUpdate(worldUpdate)
	}
}

// convertPathToDirections converts a path of nodes to a list of direction strings.
func convertPathToDirections(path []*Node) []string {
	if len(path) < 2 {
		return []string{}
	}

	directions := make([]string, 0, len(path)-1)
	for i := 0; i < len(path)-1; i++ {
		currentNode := path[i]
		nextNode := path[i+1]

		dx := nextNode.X - currentNode.X
		dy := nextNode.Y - currentNode.Y

		if dx == 1 && dy == 0 {
			directions = append(directions, "right")
		} else if dx == -1 && dy == 0 {
			directions = append(directions, "left")
		} else if dx == 0 && dy == 1 {
			directions = append(directions, "down")
		} else if dx == 0 && dy == -1 {
			directions = append(directions, "up")
		}
	}
	return directions
}