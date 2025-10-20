package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
)

// (FindOpenSpawnPoint remains the same)
func FindOpenSpawnPoint(entityID string) (int, int) {
	x, y, dx, dy := 0, 0, 0, -1
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
	log.Printf("Could not find open spawn point, defaulting to (0,0) for entity %s", entityID)
	return 0, 0
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
	pipe.HSet(ctx, inventoryKey, string(ItemWood), 100, string(ItemWoodenWall), 10)

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

		entityType := entityData["entityType"] // "player" or "npc"
		// If it's an NPC, use its more specific type
		if npcType, ok := entityData["npcType"]; ok && entityType == string(EntityTypeNPC) {
			entityType = npcType // e.g., "slime"
		}

		allEntitiesState[loc.Name] = models.EntityState{
			X:    int(loc.Longitude),
			Y:    int(loc.Latitude),
			Type: entityType, // Send the specific type
		}
	}
	// --- END UPDATE ---

	worldDataRaw, _ := rdb.HGetAll(ctx, string(RedisKeyWorldZone0)).Result()
	worldDataTyped := make(map[string]models.WorldTile)
	for coord, tileJSON := range worldDataRaw {
		var tile models.WorldTile
		json.Unmarshal([]byte(tileJSON), &tile)
		worldDataTyped[coord] = tile
	}

	inventoryData, _ := rdb.HGetAll(ctx, inventoryKey).Result()

	initialState := &models.InitialStateMessage{
		Type:      string(ServerEventInitialState),
		PlayerId:  playerID,
		Entities:  allEntitiesState, // This map now includes the 'type'
		World:     worldDataTyped,
		Inventory: inventoryData,
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
