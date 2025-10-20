package game

import (
	"log"
	"strconv"
	"time"

	"mmo-game/models"
)

func ProcessAttack(playerID string, targetEntityID string) {
	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return
	}

	targetData, err := rdb.HGetAll(ctx, targetEntityID).Result()
	if err != nil {
		log.Printf("Could not get target entity data for %s: %v", targetEntityID, err)
		return
	}
	if len(targetData) == 0 {
		// Target might have been killed by another player, just ignore.
		return
	}

	// Ensure the target is an NPC
	if targetData["entityType"] != string(EntityTypeNPC) {
		log.Printf("Player %s tried to attack non-npc entity %s.", playerID, targetEntityID)
		return
	}

	playerX, playerY := GetEntityPosition(playerData)
	targetX, targetY := GetEntityPosition(targetData)

	if !IsAdjacent(playerX, playerY, targetX, targetY) {
		log.Printf("Player %s is not adjacent to target %s to attack.", playerID, targetEntityID)
		// Silently fail, client-side check should prevent this.
		return
	}

	// For now, let's say every attack does 1 damage.
	damage := 1

	// HIncrBy is atomic, safer than Get->calculate->Set
	newHealth, err := rdb.HIncrBy(ctx, targetEntityID, "health", int64(-damage)).Result()
	if err != nil {
		log.Printf("Error decrementing health for %s: %v", targetEntityID, err)
		return
	}

	if newHealth > 0 {
		log.Printf("Entity %s damaged. Health is now %d", targetEntityID, newHealth)
		damageMsg := models.EntityDamagedMessage{
			Type:     string(ServerEventEntityDamaged),
			EntityID: targetEntityID,
			Damage:   damage,
		}
		PublishUpdate(damageMsg)
	} else {
		// Entity is defeated
		log.Printf("Entity %s defeated.", targetEntityID)
		CleanupEntity(targetEntityID, targetData)
	}

	// Set player's action cooldown
	// We'll use the moveCooldown for now as a generic action cooldown
	cooldown, _ := strconv.ParseInt(playerData["moveCooldown"], 10, 64)
	nextActionTime := time.Now().UnixMilli() + cooldown
	rdb.HSet(ctx, playerID, "nextActionAt", nextActionTime)
}
