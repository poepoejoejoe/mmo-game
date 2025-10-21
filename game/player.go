package game

import (
	"encoding/json"
	"log"
	"math/rand"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// (FindOpenSpawnPoint remains the same)
func FindOpenSpawnPoint(entityID string) (int, int) {
	// --- For Testing ---
	// If no players exist, spawn the first one at 0,0 for easy testing.
	players, _ := rdb.Keys(ctx, string(RedisKeyPlayerPrefix)+"*").Result()
	if len(players) == 0 {
		log.Println("First player spawning at 0,0 for testing.")
		return 0, 0
	}
	// --- End For Testing ---

	startX := rand.Intn(WorldSize) - WorldSize/2
	startY := rand.Intn(WorldSize) - WorldSize/2

	x, y, dx, dy := startX, startY, 0, -1
	for i := 0; i < (WorldSize * 2); i++ {
		for j := 0; j < (i/2 + 1); j++ {
			tileKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
			wasSet, _ := rdb.SetNX(ctx, tileKey, entityID, 0).Result()
			if wasSet {
				tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), strconv.Itoa(x)+","+strconv.Itoa(y)).Result()
				if err != nil {
					continue
				}
				var tile models.WorldTile
				json.Unmarshal([]byte(tileJSON), &tile)
				props := TileDefs[TileType(tile.Type)]
				if !props.IsCollidable {
					log.Printf("Found open spawn for %s at (%d, %d)", entityID, x, y)
					return x, y
				}
			}
			x, y = x+dx, y+dy
		}
		dx, dy = -dy, dx
	}
	log.Printf("Could not find open spawn point, defaulting to (%d,%d) for entity %s", startX, startY, entityID)
	return startX, startY
}

func InitializePlayer(playerID string) *models.InitialStateMessage {
	log.Printf("Initializing player %s.", playerID)
	spawnX, spawnY := FindOpenSpawnPoint(playerID)
	inventoryKey := string(RedisKeyPlayerInventory) + playerID

	pipe := rdb.Pipeline()
	// Set the player's position, cooldown, and entityType
	pipe.HSet(ctx, playerID,
		"x", spawnX,
		"y", spawnY,
		"health", PlayerDefs.MaxHealth,
		"nextActionAt", time.Now().UnixMilli(),
		"entityType", string(EntityTypePlayer), // This is the internal type
		"moveCooldown", 100, // 100ms move cooldown for players
	)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{Name: playerID, Longitude: float64(spawnX), Latitude: float64(spawnY)})

	// --- NEW: Initialize a 10-slot inventory ---
	inventory := make(map[string]interface{})
	// Slot 0: 100 Wood
	item0, _ := json.Marshal(models.Item{ID: string(ItemWood), Quantity: 100})
	inventory["slot_0"] = string(item0)
	// Slot 1: 50 Stone
	item1, _ := json.Marshal(models.Item{ID: string(ItemStone), Quantity: 50})
	inventory["slot_1"] = string(item1)
	// Slot 2: 10 Wooden Walls
	item2, _ := json.Marshal(models.Item{ID: string(ItemWoodenWall), Quantity: 10})
	inventory["slot_2"] = string(item2)

	// Initialize remaining slots as empty
	for i := 3; i < 10; i++ {
		inventory["slot_"+strconv.Itoa(i)] = "" // Empty string signifies an empty slot
	}
	pipe.HSet(ctx, inventoryKey, inventory)
	// --- END NEW ---

	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		return nil
	}

	// --- UPDATED: Gather all entity types for initial state ---
	// Use a large radius to find all entities in the zone.
	locations, _ := rdb.GeoRadius(ctx, string(RedisKeyZone0Positions), 0, 0, &redis.GeoRadiusQuery{
		Radius:    TilesToKilometers(WorldSize), // Search the entire world
		Unit:      "km",
		WithCoord: true,
	}).Result()
	allEntitiesState := make(map[string]models.EntityState)

	// This is an N+1 query. We can optimize this later with Lua or by
	// storing entity type directly in the GeoSet (if possible) or a separate set.
	// For now, this is functional.
	for _, loc := range locations {
		// Get the entity's type from its hash
		entityData, err := rdb.HGetAll(ctx, loc.Name).Result()
		if err != nil {
			continue
		}

		entityType := entityData["entityType"]

		// --- NEW: Item Visibility Logic ---
		if entityType == string(EntityTypeItem) {
			owner := entityData["owner"]
			createdAt, _ := strconv.ParseInt(entityData["createdAt"], 10, 64)
			isPublic := time.Now().UnixMilli()-createdAt >= 60000

			if owner != "" && owner != playerID && !isPublic {
				continue // Don't include this item in the initial state
			}
		}
		// --- END NEW ---

		// If it's an NPC, use its more specific type
		if npcType, ok := entityData["npcType"]; ok && entityType == string(EntityTypeNPC) {
			entityType = npcType // e.g., "slime"
		}

		entityState := models.EntityState{
			X:    int(loc.Longitude),
			Y:    int(loc.Latitude),
			Type: entityType,
		}
		if entityType == string(EntityTypeItem) {
			createdAt, _ := strconv.ParseInt(entityData["createdAt"], 10, 64)
			entityState.ItemID = entityData["itemId"]
			entityState.Owner = entityData["owner"]
			entityState.CreatedAt = createdAt
		}
		allEntitiesState[loc.Name] = entityState
	}
	// --- END UPDATE ---

	worldDataRaw, _ := rdb.HGetAll(ctx, string(RedisKeyWorldZone0)).Result()
	worldDataTyped := make(map[string]models.WorldTile)
	for coord, tileJSON := range worldDataRaw {
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)
		worldDataTyped[coord] = tile
	}

	inventoryDataRaw, _ := rdb.HGetAll(ctx, inventoryKey).Result()
	inventoryDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range inventoryDataRaw {
		if itemJSON == "" {
			continue // Skip empty slots
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		inventoryDataTyped[slot] = item
	}

	initialState := &models.InitialStateMessage{
		Type:      string(ServerEventInitialState),
		PlayerId:  playerID,
		Entities:  allEntitiesState, // This map now includes the 'type'
		World:     worldDataTyped,
		Inventory: inventoryDataTyped,
	}

	// Announce the new player's arrival to everyone else
	updateMsg := map[string]interface{}{
		"type":       string(ServerEventEntityJoined),
		"entityId":   playerID,
		"x":          spawnX,
		"y":          spawnY,
		"entityType": string(EntityTypePlayer), // <-- NEW: Send the type
	}
	PublishUpdate(updateMsg)

	// --- NEW: Send initial stats to the player ---
	statsUpdateMsg := models.PlayerStatsUpdateMessage{
		Type:      string(ServerEventPlayerStatsUpdate),
		Health:    PlayerDefs.MaxHealth,
		MaxHealth: PlayerDefs.MaxHealth,
	}
	statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
	// We need to do this after the initial state is sent, so we'll
	// just wait a moment before sending. This is a bit of a hack.
	time.AfterFunc(100*time.Millisecond, func() {
		if sendDirectMessage != nil {
			sendDirectMessage(playerID, statsUpdateJSON)
		}
	})
	// --- END NEW ---

	return initialState
}

// (CleanupPlayer remains the same as previous step)
func CleanupPlayer(playerID string) {
	log.Printf("Cleaning up player %s.", playerID)
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Could not get player data for cleanup: %v", err)
		CleanupEntity(playerID, nil)
		return
	}

	CleanupEntity(playerID, playerData)

	pipe := rdb.Pipeline()
	pipe.Del(ctx, string(RedisKeyPlayerInventory)+playerID)
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error cleaning up player inventory for %s: %v", playerID, err)
	}
}
