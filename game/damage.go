package game

import (
	"encoding/json"
	"log"
	"mmo-game/game/utils"
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
			x, y := utils.ParseCoordKey(coordKey)
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
					applyFireDamage(key, entityData, x, y)
				}
			}

			if nextCursor == 0 {
				break
			}
			cursor = nextCursor
		}
	}
}

func applyFireDamage(entityID string, entityData map[string]string, x, y int) {
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
		X:        x,
		Y:        y,
	}
	PublishUpdate(damageMsg)

	if newHealth <= 0 {
		if strings.HasPrefix(entityID, "player:") {
			HandlePlayerDeath(entityID)
		} else {
			cleanupAndDropLoot(entityID, entityData)
		}
	} else if strings.HasPrefix(entityID, "player:") {
		interruptTeleport(entityID)
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

func ApplyDamage(attackerID, defenderID string, baseDamage int) {
	defenderData, err := rdb.HGetAll(ctx, defenderID).Result()
	if err != nil {
		log.Printf("Could not get defender data for ID %s: %v", defenderID, err)
		return
	}

	currentHealth, err := strconv.Atoi(defenderData["health"])
	if err != nil {
		log.Printf("Could not parse health for defender %s: %v", defenderID, err)
		return
	}

	// Calculate defense from gear
	totalDefense := 0
	gear, err := GetGear(defenderID)
	if err == nil {
		for _, item := range gear {
			if item.ID != "" {
				itemProps := ItemDefs[ItemID(item.ID)]
				if itemProps.Equippable != nil {
					totalDefense += itemProps.Equippable.Defense
				}
			}
		}
	}

	finalDamage := baseDamage - totalDefense
	if finalDamage < 1 {
		finalDamage = 1 // Always do at least 1 damage
	}

	newHealth := currentHealth - finalDamage
	rdb.HSet(ctx, defenderID, "health", newHealth)

	defenderX, _ := strconv.Atoi(defenderData["x"])
	defenderY, _ := strconv.Atoi(defenderData["y"])

	damageMsg := models.EntityDamagedMessage{
		Type:     string(ServerEventEntityDamaged),
		EntityID: defenderID,
		Damage:   finalDamage,
		X:        defenderX,
		Y:        defenderY,
	}
	PublishUpdate(damageMsg)

	if newHealth <= 0 {
		if strings.HasPrefix(defenderID, "player:") {
			HandlePlayerDeath(defenderID)
		} else {
			cleanupAndDropLoot(defenderID, defenderData)
		}
		// Grant experience to the attacker if they are a player
		if strings.HasPrefix(attackerID, "player:") {
			if npcTypeStr, ok := defenderData["npcType"]; ok {
				if npcDef, ok := NPCDefs[NPCType(npcTypeStr)]; ok {
					AddExperience(attackerID, models.SkillAttack, npcDef.AttackXP)
					AddExperience(attackerID, models.SkillDefense, npcDef.DefenseXP)
				}
			}
		}
	} else if strings.HasPrefix(defenderID, "player:") {
		interruptTeleport(defenderID)
		h := newHealth
		mh := PlayerDefs.MaxHealth
		statsUpdateMsg := models.PlayerStatsUpdateMessage{
			Type:      string(ServerEventPlayerStatsUpdate),
			Health:    &h,
			MaxHealth: &mh,
		}
		statsUpdateJSON, _ := json.Marshal(statsUpdateMsg)
		if sendDirectMessage != nil {
			sendDirectMessage(defenderID, statsUpdateJSON)
		}
	}
}
