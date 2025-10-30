package game

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
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

			// --- NEW: Handle reconnecting as an Echo ---
			playerData, _ := rdb.HGetAll(ctx, playerID).Result()
			if isEcho, _ := strconv.ParseBool(playerData["isEcho"]); isEcho {
				rdb.HSet(ctx, playerID, "isEcho", "false")
				log.Printf("Player %s is reclaiming their Echo.", playerID)
				// Announce the Echo is gone
				updateMsg := map[string]interface{}{
					"type":     string(ServerEventEntityUpdate),
					"entityId": playerID,
					"isEcho":   false,
				}
				PublishUpdate(updateMsg)
			}
			// --- END NEW ---

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
			lon, lat := NormalizeCoords(playerEntityState.X, playerEntityState.Y)
			rdb.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{
				Name:      playerID,
				Longitude: lon,
				Latitude:  lat,
			})
			rdb.HSet(ctx, playerID, "loginTimestamp", time.Now().UnixMilli())
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
			isEcho, _ := strconv.ParseBool(entityData["isEcho"])
			entityState.IsEcho = isEcho
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
			isEcho, _ := strconv.ParseBool(playerEntityData["isEcho"])
			entityState.IsEcho = isEcho
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

	experience := make(map[models.Skill]float64)
	experienceJSON, err := rdb.HGet(ctx, playerID, "experience").Result()
	if err == nil {
		json.Unmarshal([]byte(experienceJSON), &experience)
	}

	resonance, _ := strconv.ParseInt(playerData["resonance"], 10, 64)
	echoUnlocked, _ := strconv.ParseBool(playerData["echoUnlocked"])
	runesJSON, _ := rdb.HGet(ctx, playerID, "runes").Result()
	var runes []string
	json.Unmarshal([]byte(runesJSON), &runes)
	activeRune, _ := rdb.HGet(ctx, playerID, "activeRune").Result()

	knownRecipesJSON, _ := rdb.HGet(ctx, playerID, "knownRecipes").Result()
	var knownRecipes map[string]bool
	json.Unmarshal([]byte(knownRecipesJSON), &knownRecipes)

	initialState := &models.InitialStateMessage{
		Type:         string(ServerEventInitialState),
		PlayerId:     playerID,
		Entities:     allEntitiesState,
		World:        worldDataTyped,
		Inventory:    inventoryDataTyped,
		Gear:         gearDataTyped,
		Quests:       quests.Quests,
		Experience:   experience,
		Resonance:    resonance,
		MaxResonance: 1800, // TODO: Make this dynamic
		EchoUnlocked: echoUnlocked,
		Runes:        runes,
		ActiveRune:   activeRune,
		KnownRecipes: knownRecipes,
	}

	playerHealth, _ := strconv.Atoi(playerData["health"])
	maxHealth := PlayerDefs.MaxHealth
	mr := int64(1800) // TODO: Make this dynamic
	statsUpdateMsg := models.PlayerStatsUpdateMessage{
		Type:         string(ServerEventPlayerStatsUpdate),
		Health:       &playerHealth,
		MaxHealth:    &maxHealth,
		Experience:   experience,
		Resonance:    &resonance,
		MaxResonance: &mr,
		EchoUnlocked: &echoUnlocked,
	}
	statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
	time.AfterFunc(100*time.Millisecond, func() {
		if sendDirectMessage != nil {
			sendDirectMessage(playerID, statsUpdateJSON)
		}
	})

	return initialState
}

func getPlayerPosition(playerID string) (int, int, error) {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		return 0, 0, err
	}
	x, _ := strconv.Atoi(playerData["x"])
	y, _ := strconv.Atoi(playerData["y"])
	return x, y, nil
}

func isTileAvailable(x, y int) bool {
	tileKey := string(RedisKeyLockTile) + strconv.Itoa(x) + "," + strconv.Itoa(y)
	lockExists, _ := rdb.Exists(ctx, tileKey).Result()
	if lockExists != 0 {
		return false
	}

	tileJSON, err := rdb.HGet(ctx, string(RedisKeyWorldZone0), strconv.Itoa(x)+","+strconv.Itoa(y)).Result()
	if err != nil {
		return false // Tile doesn't exist in world data.
	}

	var tile models.WorldTile
	json.Unmarshal([]byte(tileJSON), &tile)
	props := TileDefs[TileType(tile.Type)]
	return !props.IsCollidable
}

func InitializePlayer(playerID string) *models.InitialStateMessage {
	log.Printf("Initializing player %s.", playerID)
	playerData, _ := rdb.HGetAll(ctx, playerID).Result()
	spawnX, spawnY := SpawnPlayer(playerID, playerData)

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
		"loginTimestamp", time.Now().UnixMilli(),
		"resonance", 0,
		"isEcho", "false",
		"echoUnlocked", "true",
		"echoState", "idling",
		"echoTarget", "",
		"echoPath", "",
		"runes", `["chop_trees", "mine_ore"]`,
		"activeRune", "",
		"knownRecipes", `{"wooden_wall":true, "fire":true, "cooked_rat_meat":true, "crude_axe":true}`,
	)
	// --- Player position in Geo set ---
	lon, lat := NormalizeCoords(spawnX, spawnY)
	pipe.GeoAdd(ctx, string(RedisKeyZone0Positions), &redis.GeoLocation{Name: playerID, Longitude: lon, Latitude: lat})

	// --- NEW: Initialize a 10-slot inventory ---
	inventory := make(map[string]interface{})
	// Slot 0: 100 Wood
	item0, _ := json.Marshal(models.Item{ID: string(ItemWood), Quantity: 100})
	inventory["slot_0"] = string(item0)
	// Slot 1: 50 Stone
	item1, _ := json.Marshal(models.Item{ID: string(ItemStone), Quantity: 50})
	inventory["slot_1"] = string(item1)
	// Slot 2: 10 Wooden Walls
	item2, _ := json.Marshal(models.Item{ID: string(ItemWoodenWall), Quantity: 200})
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

	// iron helmet recipe for testing
	item6, _ := json.Marshal(models.Item{ID: string(ItemRecipeIronHelmet), Quantity: 1})
	inventory["slot_6"] = string(item6)

	// iron ore for testing
	item7, _ := json.Marshal(models.Item{ID: string(ItemIronOre), Quantity: 20})
	inventory["slot_7"] = string(item7)

	// Initialize remaining slots as empty
	for i := 8; i < 10; i++ {
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
	playerQuests.CompletedQuests["a_lingering_will"] = true
	questsJSON, _ := json.Marshal(playerQuests)
	pipe.HSet(ctx, playerID, "quests", questsJSON)

	// --- END NEW ---
	experience := make(map[models.Skill]float64)
	experience[models.SkillWoodcutting] = 0
	experience[models.SkillMining] = 0
	experience[models.SkillSmithing] = 0
	experience[models.SkillCooking] = 0
	experience[models.SkillConstruction] = 0
	experience[models.SkillAttack] = 0
	experience[models.SkillDefense] = 0
	experienceJSON, _ := json.Marshal(experience)
	pipe.HSet(ctx, playerID, "experience", experienceJSON)

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Println("Error initializing player in Redis:", err)
		return nil
	}

	// Announce the new player's arrival to everyone else
	playerData, redisGetAllPlayerError := rdb.HGetAll(ctx, playerID).Result()
	if redisGetAllPlayerError != nil {
		log.Printf("Error getting player data for announcement %s: %v", playerID, redisGetAllPlayerError)
	}
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

	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Error getting player data for cleanup %s: %v", playerID, err)
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

	resonance, _ := strconv.ParseInt(playerData["resonance"], 10, 64)

	if resonance > 0 {
		// --- BECOME AN ECHO ---
		rdb.HSet(ctx, playerID, "isEcho", "true")
		updateMsg := map[string]interface{}{
			"type":     string(ServerEventEntityUpdate),
			"entityId": playerID,
			"isEcho":   true,
		}
		PublishUpdate(updateMsg)
		log.Printf("Player %s has become an Echo.", playerID)

	} else {
		// --- DISCONNECT NORMALLY ---
		// Announce the entity has left
		leftMsg := map[string]interface{}{
			"type":     string(ServerEventEntityLeft),
			"entityId": playerID,
		}
		PublishUpdate(leftMsg)

		// Remove the entity from the geospatial index, but do NOT delete their data.
		rdb.ZRem(ctx, string(RedisKeyZone0Positions), playerID)
		log.Printf("Player %s has disconnected.", playerID)
	}
}

// GetEntityData retrieves all HSET data for a given entity ID.
func GetEntityData(entityID string) (map[string]string, error) {
	return rdb.HGetAll(ctx, entityID).Result()
}

// SetEchoState sets the echo state for a player and notifies the client.
func SetEchoState(playerID string, enabled bool) {
	pipe := rdb.Pipeline()
	pipe.HSet(ctx, playerID, "isEcho", strconv.FormatBool(enabled))
	// Also reset the echo state machine to idling for a clean transition.
	pipe.HSet(ctx, playerID, "echoState", string(EchoStateIdling))
	pipe.Exec(ctx)

	// Update the player's client to reflect the change.
	updateMsg := map[string]interface{}{
		"type":     string(ServerEventEntityUpdate),
		"entityId": playerID,
		"isEcho":   enabled,
	}
	PublishUpdate(updateMsg)
}

func AddExperience(playerID string, skill models.Skill, amount float64) {
	vals, err := rdb.HMGet(ctx, playerID, "isEcho", "experience").Result()
	if err != nil {
		log.Printf("Error getting player data for AddExperience %s: %v", playerID, err)
		return
	}

	var isEchoStr string
	if vals[0] != nil {
		isEchoStr, _ = vals[0].(string)
	}
	isEcho, _ := strconv.ParseBool(isEchoStr)

	var experienceJSON string
	if vals[1] != nil {
		experienceJSON, _ = vals[1].(string)
	}

	pipe := rdb.Pipeline()

	experience := make(map[models.Skill]float64)
	if experienceJSON != "" {
		err := json.Unmarshal([]byte(experienceJSON), &experience)
		if err != nil {
			log.Printf("Error unmarshalling experience for player %s: %v", playerID, err)
		}
	}

	experience[skill] += amount
	newExperienceJSON, _ := json.Marshal(experience)
	pipe.HSet(ctx, playerID, "experience", newExperienceJSON)

	if !isEcho {
		pipe.HIncrBy(ctx, playerID, "resonance", 5) // Add 5 seconds of resonance
	}

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("Error setting experience for player %s: %v", playerID, err)
		return
	}
	playerData, _ := rdb.HGetAll(ctx, playerID).Result()
	playerHealth, _ := strconv.Atoi(playerData["health"])
	resonance, _ := strconv.ParseInt(playerData["resonance"], 10, 64)
	echoUnlocked, _ := strconv.ParseBool(playerData["echoUnlocked"])
	maxHealth := PlayerDefs.MaxHealth
	mr := int64(1800) // TODO: Make this dynamic
	statsUpdateMsg := models.PlayerStatsUpdateMessage{
		Type:         string(ServerEventPlayerStatsUpdate),
		Health:       &playerHealth,
		MaxHealth:    &maxHealth,
		Experience:   experience,
		Resonance:    &resonance,
		MaxResonance: &mr,
		EchoUnlocked: &echoUnlocked,
	}
	statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
	if sendDirectMessage != nil {
		sendDirectMessage(playerID, statsUpdateJSON)
	}
}
