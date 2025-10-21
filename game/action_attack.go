package game

import (
	"log"
	"strconv"
	"time"

	"mmo-game/models"
)

func ProcessAttack(playerID string, targetEntityID string) *models.EntityDamagedMessage {
	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return nil
	}

	targetData, err := rdb.HGetAll(ctx, targetEntityID).Result()
	if err != nil {
		log.Printf("Could not get target entity data for %s: %v", targetEntityID, err)
		return nil
	}
	if len(targetData) == 0 {
		// Target might have been killed by another player, just ignore.
		return nil
	}

	// Ensure the target is an NPC
	if targetData["entityType"] != string(EntityTypeNPC) {
		log.Printf("Player %s tried to attack non-npc entity %s.", playerID, targetEntityID)
		return nil
	}

	playerX, playerY := GetEntityPosition(playerData)
	targetX, targetY := GetEntityPosition(targetData)

	if !IsAdjacent(playerX, playerY, targetX, targetY) {
		log.Printf("Player %s is not adjacent to target %s to attack.", playerID, targetEntityID)
		// Silently fail, client-side check should prevent this.
		return nil
	}

	// For now, let's say every attack does 1 damage.
	damage := 1

	// Check for weapon damage bonus
	gear, err := GetGear(playerID)
	if err == nil {
		if weapon, ok := gear["weapon-slot"]; ok {
			if weaponProps := ItemDefs[ItemID(weapon.ID)]; weaponProps.Equippable != nil {
				damage += weaponProps.Equippable.Damage
			}
		}
	}

	damageDealtKey := "npc:" + targetEntityID + ":damage_dealt"
	rdb.HIncrBy(ctx, damageDealtKey, playerID, int64(damage))

	// HIncrBy is atomic, safer than Get->calculate->Set
	newHealth, err := rdb.HIncrBy(ctx, targetEntityID, "health", int64(-damage)).Result()
	if err != nil {
		log.Printf("Error decrementing health for %s: %v", targetEntityID, err)
		return nil
	}

	damageMsg := &models.EntityDamagedMessage{
		Type:     string(ServerEventEntityDamaged),
		EntityID: targetEntityID,
		Damage:   damage,
		X:        targetX,
		Y:        targetY,
	}

	if newHealth > 0 {
		log.Printf("Entity %s damaged. Health is now %d", targetEntityID, newHealth)
		PublishUpdate(damageMsg)
	} else {
		// Entity is defeated
		log.Printf("Entity %s defeated.", targetEntityID)
		cleanupAndDropLoot(targetEntityID, targetData)
	}

	// We'll use a standard action cooldown.
	nextActionTime := time.Now().Add(BaseActionCooldown).UnixMilli()
	rdb.HSet(ctx, playerID, "nextActionAt", nextActionTime)
	return damageMsg
}

func cleanupAndDropLoot(npcID string, npcData map[string]string) {
	CleanupEntity(npcID, npcData)

	damageDealtKey := "npc:" + npcID + ":damage_dealt"
	damageData, err := rdb.HGetAll(ctx, damageDealtKey).Result()
	var ownerID string = ""
	var maxDamage int64 = 0

	if err == nil && len(damageData) > 0 {
		for player, damageStr := range damageData {
			damage, _ := strconv.ParseInt(damageStr, 10, 64)
			if damage > maxDamage {
				maxDamage = damage
				ownerID = player
			}
		}
	}
	rdb.Del(ctx, damageDealtKey)

	npcType := NPCType(npcData["npcType"])
	loot := generateLoot(npcType)

	if len(loot) > 0 {
		x, _ := strconv.Atoi(npcData["x"])
		y, _ := strconv.Atoi(npcData["y"])
		for itemID, quantity := range loot {
			dropID, createdAt, publicAt, err := CreateWorldItem(x, y, itemID, quantity, ownerID, time.Minute*1)
			if err != nil {
				log.Printf("Failed to create world item from loot: %v", err)
				continue
			}

			itemUpdate := map[string]interface{}{
				"type":       string(ServerEventEntityJoined),
				"entityId":   dropID,
				"entityType": string(EntityTypeItem),
				"itemId":     string(itemID),
				"x":          x,
				"y":          y,
				"owner":      ownerID,
				"createdAt":  createdAt,
				"publicAt":   publicAt,
			}
			PublishUpdate(itemUpdate)
		}
	}
}
