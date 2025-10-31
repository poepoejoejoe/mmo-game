package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
)

// SendToPlayer sends a message directly to a specific player.
// This is a convenience wrapper around sendDirectMessage for consistency.
//
// Usage:
//   SendToPlayer(playerID, &models.InventoryUpdateMessage{...})
func SendToPlayer(playerID string, message interface{}) {
	jsonMsg, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling message for player %s: %v", playerID, err)
		return
	}
	sendDirectMessage(playerID, jsonMsg)
}

// Broadcast sends a message to all players in the game.
// This is a convenience wrapper around PublishUpdate for consistency.
//
// Usage:
//   Broadcast(&models.WorldUpdateMessage{...})
func Broadcast(message interface{}) {
	PublishUpdate(message)
}

// SendPrivately sends a private message to a specific player.
// This is a convenience wrapper around PublishPrivately for consistency.
//
// Usage:
//   SendPrivately(playerID, &models.NotificationMessage{...})
func SendPrivately(playerID string, message interface{}) {
	PublishPrivately(playerID, message)
}

// CreateInventoryUpdateMessage creates a standardized inventory update message.
// This helper reduces boilerplate when sending inventory updates.
//
// Usage:
//   inventoryMsg := CreateInventoryUpdateMessage(playerID)
//   SendToPlayer(playerID, inventoryMsg)
func CreateInventoryUpdateMessage(playerID string) *models.InventoryUpdateMessage {
	inventory, err := GetInventory(playerID)
	if err != nil {
		log.Printf("Error getting inventory for player %s: %v", playerID, err)
		return nil
	}
	return &models.InventoryUpdateMessage{
		Type:      string(ServerEventInventoryUpdate),
		Inventory: inventory,
	}
}

// CreateStateCorrectionMessage creates a standardized state correction message.
// This is sent when a client's state needs to be corrected (e.g., invalid move).
//
// Usage:
//   correctionMsg := CreateStateCorrectionMessage(playerX, playerY)
//   result.AddToPlayer(correctionMsg)
func CreateStateCorrectionMessage(x, y int) models.WebSocketMessage {
	correctionMsg := &models.StateCorrectionMessage{
		Type: string(ServerEventStateCorrection),
		X:    x,
		Y:    y,
	}
	correctionJSON, _ := json.Marshal(correctionMsg)
	return models.WebSocketMessage{
		Type:    correctionMsg.Type,
		Payload: correctionJSON,
	}
}

// CreateNotificationMessage creates a standardized notification message.
// This is useful for sending text notifications to players.
//
// Usage:
//   notification := CreateNotificationMessage("Your item was crafted!")
//   SendToPlayer(playerID, notification)
func CreateNotificationMessage(message string) *models.NotificationMessage {
	return &models.NotificationMessage{
		Type:    string(ServerEventNotification),
		Message: message,
	}
}

// CreateStatsUpdateMessage creates a standardized player stats update message.
// This includes health, experience, resonance, and other player stats.
//
// Usage:
//   statsMsg := CreateStatsUpdateMessage(playerID)
//   statsJSON, _ := json.Marshal(statsMsg)
//   result.AddToPlayer(models.WebSocketMessage{
//       Type:    statsMsg.Type,
//       Payload: statsJSON,
//   })
func CreateStatsUpdateMessage(playerID string) *models.PlayerStatsUpdateMessage {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Error getting player data for stats update: %v", err)
		return nil
	}

	msg := &models.PlayerStatsUpdateMessage{
		Type: string(ServerEventPlayerStatsUpdate),
	}

	// Parse health
	if healthStr, ok := playerData["health"]; ok && healthStr != "" {
		if health, err := strconv.Atoi(healthStr); err == nil {
			msg.Health = &health
		}
	}

	// Parse max health (use PlayerDefs)
	maxHealth := PlayerDefs.MaxHealth
	msg.MaxHealth = &maxHealth

	// Parse experience
	if expJSON, ok := playerData["experience"]; ok && expJSON != "" {
		var experience map[models.Skill]float64
		if err := json.Unmarshal([]byte(expJSON), &experience); err == nil {
			msg.Experience = experience
		}
	}

	// Parse resonance
	if resonanceStr, ok := playerData["resonance"]; ok && resonanceStr != "" {
		if resonance, err := strconv.ParseInt(resonanceStr, 10, 64); err == nil {
			msg.Resonance = &resonance
		}
	}

	// Parse max resonance
	if maxResonanceStr, ok := playerData["maxResonance"]; ok && maxResonanceStr != "" {
		if maxResonance, err := strconv.ParseInt(maxResonanceStr, 10, 64); err == nil {
			msg.MaxResonance = &maxResonance
		}
	}

	// Parse echo unlocked
	if echoUnlockedStr, ok := playerData["echoUnlocked"]; ok && echoUnlockedStr != "" {
		if echoUnlocked, err := strconv.ParseBool(echoUnlockedStr); err == nil {
			msg.EchoUnlocked = &echoUnlocked
		}
	}

	return msg
}

// CreateGearUpdateMessage creates a standardized gear update message.
//
// Usage:
//   gearMsg := CreateGearUpdateMessage(playerID)
//   gearJSON, _ := json.Marshal(gearMsg)
//   result.AddToPlayer(models.WebSocketMessage{
//       Type:    gearMsg.Type,
//       Payload: gearJSON,
//   })
func CreateGearUpdateMessage(playerID string) *models.GearUpdateMessage {
	gear, err := GetGear(playerID)
	if err != nil {
		log.Printf("Error getting gear for player %s: %v", playerID, err)
		return nil
	}
	return &models.GearUpdateMessage{
		Type: string(ServerEventGearUpdate),
		Gear: gear,
	}
}

// CreateBankUpdateMessage creates a standardized bank update message.
//
// Usage:
//   bankMsg := CreateBankUpdateMessage(playerID)
//   bankJSON, _ := json.Marshal(bankMsg)
//   result.AddToPlayer(models.WebSocketMessage{
//       Type:    bankMsg.Type,
//       Payload: bankJSON,
//   })
func CreateBankUpdateMessage(playerID string) *models.BankUpdateMessage {
	bank, err := GetBank(playerID)
	if err != nil {
		log.Printf("Error getting bank for player %s: %v", playerID, err)
		return nil
	}
	return &models.BankUpdateMessage{
		Type: string(ServerEventBankUpdate),
		Bank: bank,
	}
}

// Message sending patterns:
//
// 1. Private updates (inventory, stats, notifications):
//    SendToPlayer(playerID, &models.InventoryUpdateMessage{...})
//    or: SendPrivately(playerID, &models.NotificationMessage{...})
//
// 2. World updates (entity movements, tile changes):
//    Broadcast(&models.WorldUpdateMessage{...})
//    or: Broadcast(&models.EntityMovedMessage{...})
//
// 3. Within ActionResult (for registry-based actions):
//    result.AddToPlayer(models.WebSocketMessage{...})
//    result.AddToBroadcast(models.WebSocketMessage{...})
//
// 4. Direct messages (for immediate updates, bypasses registry):
//    sendDirectMessage(playerID, messageJSON)
//    PublishUpdate(message)

