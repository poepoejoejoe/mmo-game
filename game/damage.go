package game

import (
	"encoding/json"
	"log"
	"mmo-game/game/utils"
	"mmo-game/models"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

func StartDamageSystem() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		checkFires()
	}
}

func checkFires() {
	// Use GEORADIUS to find only fire tiles, instead of scanning the whole world.
	// We search from the center of the map with a radius large enough to cover everything.
	const searchRadiusKm = 20000
	query := &redis.GeoRadiusQuery{
		Radius: searchRadiusKm,
		Unit:   "km",
	}
	locations, err := rdb.GeoRadius(ctx, string(RedisKeyResourcePositions), 0, 0, query).Result()
	if err != nil {
		log.Printf("Failed to get resource locations for fire check: %v", err)
		return
	}

	for _, loc := range locations {
		// The member name is "tileType:x,y". We only care about fires.
		if strings.HasPrefix(loc.Name, string(TileTypeFire)+":") {
			log.Println("Found fire tile in resource set:", loc.Name)
			coordKey := strings.Split(loc.Name, ":")[1]
			x, y := utils.ParseCoordKey(coordKey)
			checkForEntitiesOnFire(x, y)
		}
	}
}

func checkForEntitiesOnFire(x, y int) {
	// Use a precise GEORADIUS query to find entities at the exact location of the fire.
	// This is much more efficient than scanning all entities.
	query := &redis.GeoRadiusQuery{
		Radius: 50, // A large radius to cover the entire "degree" tile
		Unit:   "km",
	}

	locations, err := rdb.GeoRadius(ctx, string(RedisKeyZone0Positions), float64(x), float64(y), query).Result()
	if err != nil {
		log.Printf("Error getting entities at fire location (%d, %d): %v", x, y, err)
		return
	}

	for _, loc := range locations {
		// loc.Name is the entity ID
		entityData, err := rdb.HGetAll(ctx, loc.Name).Result()
		if err == nil {
			applyFireDamage(loc.Name, entityData, x, y)
		}
	}
}

func applyFireDamage(entityID string, entityData map[string]string, x, y int) {
	log.Printf("Applying fire damage to entity %s", entityID)
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
