package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"strings"
	"time"
)

func handleFireDamage() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		checkFires()
	}
}

func checkFires() {
	worldData, err := rdb.HGetAll(ctx, string(RedisKeyWorldZone0)).Result()
	if err != nil {
		log.Printf("Failed to get world data for fire check: %v", err)
		return
	}

	for coordKey, tileJSON := range worldData {
		var tile models.WorldTile
		if err := json.Unmarshal([]byte(tileJSON), &tile); err == nil && TileType(tile.Type) == TileTypeFire {
			x, y := parseCoordKey(coordKey)
			checkForEntitiesOnFire(x, y)
		}
	}
}

func checkForEntitiesOnFire(x, y int) {
	// Use a SCAN to find entities at the fire's location. This is more efficient
	// than fetching all entities. We'll check for both players and NPCs.
	entityTypes := []string{"player:*", "npc:*"}

	for _, pattern := range entityTypes {
		var cursor uint64
		for {
			keys, nextCursor, err := rdb.Scan(ctx, cursor, pattern, 100).Result()
			if err != nil {
				log.Printf("Error scanning for entities: %v", err)
				break
			}

			for _, key := range keys {
				entityData, err := rdb.HGetAll(ctx, key).Result()
				if err != nil {
					continue
				}

				entityX, _ := strconv.Atoi(entityData["x"])
				entityY, _ := strconv.Atoi(entityData["y"])

				if entityX == x && entityY == y {
					applyFireDamage(key, entityData)
				}
			}

			if nextCursor == 0 {
				break
			}
			cursor = nextCursor
		}
	}
}

func applyFireDamage(entityID string, entityData map[string]string) {
	fireProps := TileDefs[TileTypeFire]
	newHealth, err := rdb.HIncrBy(ctx, entityID, "health", int64(-fireProps.Damage)).Result()
	if err != nil {
		log.Printf("Error applying fire damage to %s: %v", entityID, err)
		return
	}

	damageMsg := models.EntityDamagedMessage{
		Type:     string(ServerEventEntityDamaged),
		EntityID: entityID,
		Damage:   fireProps.Damage,
	}
	PublishUpdate(damageMsg)

	if newHealth <= 0 {
		if strings.HasPrefix(entityID, "player:") {
			HandlePlayerDeath(entityID)
		} else {
			cleanupAndDropLoot(entityID, entityData)
		}
	} else if strings.HasPrefix(entityID, "player:") {
		// Also send a stats update to the player who was damaged
		experience := make(map[models.Skill]float64)
		experienceJSON, err := rdb.HGet(ctx, entityID, "experience").Result()
		if err == nil {
			json.Unmarshal([]byte(experienceJSON), &experience)
		}

		h := int(newHealth)
		mh := PlayerDefs.MaxHealth
		statsUpdateMsg := models.PlayerStatsUpdateMessage{
			Type:       string(ServerEventPlayerStatsUpdate),
			Health:     &h,
			MaxHealth:  &mh,
			Experience: experience,
		}
		statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
		if sendDirectMessage != nil {
			sendDirectMessage(entityID, statsUpdateJSON)
		}
	}
}

func parseCoordKey(coordKey string) (int, int) {
	parts := strings.Split(coordKey, ",")
	if len(parts) != 2 {
		return 0, 0
	}
	x, _ := strconv.Atoi(parts[0])
	y, _ := strconv.Atoi(parts[1])
	return x, y
}
