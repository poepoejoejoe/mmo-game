package game

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	mrand "math/rand"
	"mmo-game/game/utils"
	"mmo-game/models"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

func generateSecretKey() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func LoginPlayer(secretKey string) (string, *models.InitialStateMessage) {
	if secretKey == "" {
		// This is a guest login.
		playerID := string(RedisKeyPlayerPrefix) + uuid.New().String()
		log.Printf("New guest player connecting. Assigning temporary ID: %s", playerID)
		initialState := InitializePlayer(playerID)
		return playerID, initialState
	}

	// This is a returning player.
	playerID, err := rdb.Get(ctx, string(RedisKeySecretPrefix)+secretKey).Result()
	if err == redis.Nil {
		// The key is invalid. Treat them as a new guest.
		log.Printf("Invalid secret key received. Treating as new guest.")
		playerID := string(RedisKeyPlayerPrefix) + uuid.New().String()
		initialState := InitializePlayer(playerID)
		return playerID, initialState
	} else if err != nil {
		log.Printf("Error retrieving player ID from secret key: %v", err)
		return "", nil
	}

	log.Printf("Player %s reconnecting with secret key.", playerID)

	// --- NEW: Add player back to the world and announce their arrival ---
	// Get player's state before announcing their return
	initialState := getPlayerState(playerID)
	if initialState != nil {
		if playerEntityState, ok := initialState.Entities[playerID]; ok {
			// Announce the player's return to everyone else
			updateMsg := map[string]interface{}{
				"type":       string(ServerEventEntityJoined),
				"entityId":   playerID,
				"x":          playerEntityState.X,
				"y":          playerEntityState.Y,
				"entityType": string(EntityTypePlayer),
				"name":       playerEntityState.Name,
				"shirtColor": playerEntityState.ShirtColor,
				"gear":       playerEntityState.Gear,
			}
			PublishUpdate(updateMsg)

			// Also add them back to the geospatial index
			rdb.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
				Name:      playerID,
				Longitude: float64(playerEntityState.X),
				Latitude:  float64(playerEntityState.Y),
			})
		}
	}
	// --- END NEW ---

	return playerID, initialState
}

func RegisterPlayer(playerID string, name string) (*models.RegisteredMessage, *models.InitialStateMessage) {
	// 1. Validate the name (basic validation for now)
	if len(name) < 3 || len(name) > 15 {
		// Maybe send an error message back to the client in the future.
		log.Printf("Player %s tried to register with invalid name: %s", playerID, name)
		return nil, nil
	}

	// 2. Generate a new secret key
	secretKey, err := generateSecretKey()
	if err != nil {
		log.Printf("Failed to generate secret key for player %s: %v", playerID, err)
		return nil, nil
	}

	// 3. Update the player's data in Redis
	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "name", name)
	pipe.Set(ctx, string(RedisKeySecretPrefix)+secretKey, playerID, 0) // No expiration for now
	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Failed to save registered player data for %s: %v", playerID, err)
		return nil, nil
	}

	log.Printf("Player %s has registered with name %s", playerID, name)

	// 4. Create the confirmation message
	registeredMsg := &models.RegisteredMessage{
		Type:      string(ServerEventRegistered),
		SecretKey: secretKey,
		PlayerId:  playerID,
		Name:      name,
	}

	// 5. Get the current full state to send to the new player
	initialState := getPlayerState(playerID)

	// 6. Announce the player's "real" name to the world
	updateMsg := map[string]interface{}{
		"type":     string(ServerEventEntityJoined),
		"entityId": playerID,
		"name":     name,
		// We also need to send x and y, so let's fetch them.
		"x":          initialState.Entities[playerID].X,
		"y":          initialState.Entities[playerID].Y,
		"entityType": string(EntityTypePlayer),
		"shirtColor": initialState.Entities[playerID].ShirtColor,
		"gear":       initialState.Entities[playerID].Gear,
	}
	PublishUpdate(updateMsg)

	return registeredMsg, initialState
}

// getPlayerState is a helper function to gather the full world state for a player.
func getPlayerState(playerID string) *models.InitialStateMessage {
	playerData, _ := rdb.HGetAll(ctx, playerID).Result()
	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	gearKey := string(RedisKeyPlayerGear) + playerID

	// Use a large radius to find all entities in the zone.
	locations, _ := rdb.GeoRadius(ctx, string(RedisKeyZone0Positions), 0, 0, &redis.GeoRadiusQuery{
		Radius:    TilesToKilometers(WorldSize), // Search the entire world
		Unit:      "km",
		WithCoord: true,
	}).Result()
	allEntitiesState := make(map[string]models.EntityState)

	for _, loc := range locations {
		entityData, err := rdb.HGetAll(ctx, loc.Name).Result()
		if err != nil {
			continue
		}

		entityType := entityData["entityType"]

		if entityType == string(EntityTypeItem) {
			owner := entityData["owner"]
			createdAt, _ := strconv.ParseInt(entityData["createdAt"], 10, 64)
			isPublic := time.Now().UnixMilli()-createdAt >= 60000

			if owner != "" && owner != playerID && !isPublic {
				continue
			}
		}

		entityState := models.EntityState{
			X:    int(loc.Longitude),
			Y:    int(loc.Latitude),
			Type: entityType,
		}

		if npcType, ok := entityData["npcType"]; ok && entityType == string(EntityTypeNPC) {
			entityState.Type = string(EntityTypeNPC)
			entityState.Name = npcType
			if NPCType(npcType) == NPCTypeWizard {
				if IsQuestReadyToTurnInToWizard(playerID) {
					entityState.QuestState = "turn-in-ready"
				} else if HasActiveQuestFromWizard(playerID) {
					entityState.QuestState = "in-progress"
				} else if CanAcceptAnyQuestFromWizard(playerID) {
					entityState.QuestState = "available"
				}
			}
		} else if name, ok := entityData["name"]; ok {
			entityState.Name = name
		}

		if shirtColor, ok := entityData["shirtColor"]; ok {
			entityState.ShirtColor = shirtColor
		}

		if entityType == string(EntityTypeItem) {
			createdAt, _ := strconv.ParseInt(entityData["createdAt"], 10, 64)
			entityState.ItemID = entityData["itemId"]
			entityState.Owner = entityData["owner"]
			entityState.CreatedAt = createdAt
		}
		if entityType == string(EntityTypePlayer) {
			gear, _ := GetGear(loc.Name)
			entityState.Gear = gear
		}
		allEntitiesState[loc.Name] = entityState
	}

	// --- NEW: Ensure the player's own entity is included ---
	// This is crucial because the player might not be in the GeoRadius result
	// if they are reconnecting after a cleanup.
	if _, ok := allEntitiesState[playerID]; !ok {
		playerEntityData, err := rdb.HGetAll(ctx, playerID).Result()
		if err == nil {
			x, _ := strconv.Atoi(playerEntityData["x"])
			y, _ := strconv.Atoi(playerEntityData["y"])
			entityState := models.EntityState{
				ID:         playerID,
				X:          x,
				Y:          y,
				Type:       playerEntityData["entityType"],
				Name:       playerEntityData["name"],
				ShirtColor: playerEntityData["shirtColor"],
			}
			gear, _ := GetGear(playerID)
			entityState.Gear = gear
			allEntitiesState[playerID] = entityState
		}
	}
	// --- END NEW ---

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
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		inventoryDataTyped[slot] = item
	}

	gearDataRaw, _ := rdb.HGetAll(ctx, gearKey).Result()
	gearDataTyped := make(map[string]models.Item)
	for slot, itemJSON := range gearDataRaw {
		if itemJSON == "" {
			continue
		}
		var item models.Item
		json.Unmarshal([]byte(itemJSON), &item)
		gearDataTyped[slot] = item
	}

	quests, err := GetPlayerQuests(playerID)
	if err != nil {
		log.Printf("Error getting quests for player %s: %v", playerID, err)
		quests = &models.PlayerQuests{Quests: make(map[models.QuestID]*models.Quest)}
	}

	initialState := &models.InitialStateMessage{
		Type:      string(ServerEventInitialState),
		PlayerId:  playerID,
		Entities:  allEntitiesState,
		World:     worldDataTyped,
		Inventory: inventoryDataTyped,
		Gear:      gearDataTyped,
		Quests:    quests.Quests,
	}

	playerHealth, _ := strconv.Atoi(playerData["health"])
	statsUpdateMsg := models.PlayerStatsUpdateMessage{
		Type:      string(ServerEventPlayerStatsUpdate),
		Health:    playerHealth,
		MaxHealth: PlayerDefs.MaxHealth,
	}
	statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
	time.AfterFunc(100*time.Millisecond, func() {
		if sendDirectMessage != nil {
			sendDirectMessage(playerID, statsUpdateJSON)
		}
	})

	return initialState
}

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

	startX := mrand.Intn(WorldSize) - WorldSize/2
	startY := mrand.Intn(WorldSize) - WorldSize/2

	x, y, dx, dy := startX, startY, 0, -1
	for i := 0; i < (WorldSize * 2); i++ {
		for j := 0; j < (i/2 + 1); j++ {
			tileKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
			// Check if the tile is already locked.
			lockExists, _ := rdb.Exists(ctx, tileKey).Result()
			if lockExists == 0 {
				tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), strconv.Itoa(x)+","+strconv.Itoa(y)).Result()
				if err != nil {
					// This tile doesn't exist in the world data, skip.
					continue
				}
				var tile models.WorldTile
				json.Unmarshal([]byte(tileJSON), &tile)
				props := TileDefs[TileType(tile.Type)]
				if !props.IsCollidable {
					log.Printf("Found open spawn for %s at (%d, %d)", entityID, x, y)
					// Don't lock it here, just return the coordinates.
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

	// Lock the spawn tile for the player
	locked, err := LockTileForEntity(playerID, spawnX, spawnY)
	if err != nil || !locked {
		log.Printf("Failed to lock spawn tile for player %s at %d,%d. Retrying.", playerID, spawnX, spawnY)
		// Simple retry logic, could be improved
		time.Sleep(100 * time.Millisecond)
		return InitializePlayer(playerID)
	}

	inventoryKey := string(RedisKeyPlayerInventory) + playerID
	gearKey := string(RedisKeyPlayerGear) + playerID

	pipe := rdb.Pipeline()
	// Set the player's position, cooldown, and entityType
	pipe.HSet(ctx, playerID,
		"x", spawnX,
		"y", spawnY,
		"health", PlayerDefs.MaxHealth,
		"nextActionAt", time.Now().UnixMilli(),
		"entityType", string(EntityTypePlayer), // This is the internal type
		"moveCooldown", 100, // 100ms move cooldown for players
		"shirtColor", utils.GenerateRandomColor(),
	)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{Name: playerID, Longitude: float64(spawnX), Latitude: float64(spawnY)})

	// --- For Testing: Add items to the world ---
	// If this is the first player, add some items nearby.
	players, _ := rdb.Keys(ctx, string(RedisKeyPlayerPrefix)+"*").Result()
	if len(players) <= 1 { // <= 1 because this player is already created
		CreateWorldItem(1, 0, ItemTreasureMap, 1, "", 0)
		CreateWorldItem(2, 0, ItemSliceOfPizza, 1, "", 0)
	}
	// --- End For Testing ---

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

	// Slot 3: 1 Rat meat for testing
	item3, _ := json.Marshal(models.Item{ID: string(ItemRatMeat), Quantity: 1})
	inventory["slot_3"] = string(item3)

	// Slot 4: 10 Goop for testing
	item4, _ := json.Marshal(models.Item{ID: string(ItemGoop), Quantity: 10})
	inventory["slot_4"] = string(item4)

	// crude axe for testing
	item5, _ := json.Marshal(models.Item{ID: string(ItemCrudeAxe), Quantity: 1})
	inventory["slot_5"] = string(item5)

	// Initialize remaining slots as empty
	for i := 6; i < 10; i++ {
		inventory["slot_"+strconv.Itoa(i)] = "" // Empty string signifies an empty slot
	}
	pipe.HSet(ctx, inventoryKey, inventory)
	pipe.HSet(ctx, gearKey, map[string]interface{}{"weapon-slot": ""})

	// For testing: complete the first quest
	playerQuests := &models.PlayerQuests{
		Quests:          make(map[models.QuestID]*models.Quest),
		CompletedQuests: make(map[models.QuestID]bool),
	}
	playerQuests.CompletedQuests[models.QuestBuildAWall] = true
	playerQuests.CompletedQuests[models.QuestRatProblem] = true
	questsJSON, _ := json.Marshal(playerQuests)
	pipe.HSet(ctx, playerID, "quests", questsJSON)

	// --- END NEW ---

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		return nil
	}

	// Announce the new player's arrival to everyone else
	playerData, _ := rdb.HGetAll(ctx, playerID).Result()
	updateMsg := map[string]interface{}{
		"type":       string(ServerEventEntityJoined),
		"entityId":   playerID,
		"id":         playerID,
		"x":          spawnX,
		"y":          spawnY,
		"entityType": string(EntityTypePlayer), // Guests don't have a name yet
		"shirtColor": playerData["shirtColor"],
		"gear":       make(map[string]models.Item),
	}
	PublishUpdate(updateMsg)

	return getPlayerState(playerID)
}

// (CleanupPlayer remains the same as previous step)
func CleanupPlayer(playerID string) {
	log.Printf("Cleaning up player %s.", playerID)

	// --- NEW: Get player's position and remove their tile lock ---
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Error getting player data for cleanup %s: %v", playerID, err)
		// We should still proceed with cleanup as much as possible.
	} else {
		if xStr, ok := playerData["x"]; ok {
			if yStr, ok := playerData["y"]; ok {
				x, _ := strconv.Atoi(xStr)
				y, _ := strconv.Atoi(yStr)
				UnlockTileForEntity(playerID, x, y)
				log.Printf("Removed tile lock for player %s at %s,%s", playerID, xStr, yStr)
			}
		}
	}
	// --- END NEW ---

	// Announce the entity has left
	leftMsg := map[string]interface{}{
		"type":     string(ServerEventEntityLeft),
		"entityId": playerID,
	}
	PublishUpdate(leftMsg)

	// Remove the entity from the geospatial index, but do NOT delete their data.
	rdb.ZRem(ctx, string(RedisKeyZone0Positions), playerID)
}
