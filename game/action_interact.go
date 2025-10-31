package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"strings"
	"time"
)

func ProcessInteract(playerID string, payload json.RawMessage) (*models.StateCorrectionMessage, *models.InventoryUpdateMessage) {
	var interactData models.InteractPayload
	if err := json.Unmarshal(payload, &interactData); err != nil {
		return nil, nil
	}

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return nil, nil
	}

	currentX, currentY := GetEntityPosition(playerData)

	// --- NEW: Handle Entity Interaction ---
	if interactData.EntityID != "" {
		targetData, err := rdb.HGetAll(ctx, interactData.EntityID).Result()
		if err != nil || len(targetData) == 0 {
			return nil, nil // Invalid target
		}

		entityType := targetData["entityType"]

		// --- NPC Interaction ---
		if entityType == string(EntityTypeNPC) {
			targetX, _ := strconv.Atoi(targetData["x"])
			targetY, _ := strconv.Atoi(targetData["y"])
			UpdateEntityDirection(playerID, targetX, targetY)

			npcType := NPCType(targetData["npcType"])
			if npcType == NPCTypeWizard {
				dialog := GetWizardDialog(playerID)
				dialogJSON, _ := json.Marshal(dialog)
				sendDirectMessage(playerID, dialogJSON)
			}
			if npcType == NPCTypeGolemBanker {
				// Send a message to the client to open the bank window
				openBankMsg := map[string]interface{}{
					"type": string(ServerEventOpenBankWindow),
				}
				openBankJSON, _ := json.Marshal(openBankMsg)
				sendDirectMessage(playerID, openBankJSON)

				// Also send the initial bank state
				bankKey := "bank:" + playerID
				bankMsg := getBankUpdateMessage(bankKey)
				if bankMsg != nil {
					bankJSON, _ := json.Marshal(bankMsg)
					sendDirectMessage(playerID, bankJSON)
				}
			}
			return nil, nil // End interaction after talking
		}

		// --- Item Pickup ---
		if entityType == string(EntityTypeItem) {
			targetX, _ := strconv.Atoi(targetData["x"])
			targetY, _ := strconv.Atoi(targetData["y"])

			if !IsWithinPickupRange(currentX, currentY, targetX, targetY) {
				return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
			}

			owner := targetData["owner"]
			publicAt, _ := strconv.ParseInt(targetData["publicAt"], 10, 64)

			isPublic := owner == "" || (publicAt > 0 && time.Now().UnixMilli() >= publicAt)
			if owner == playerID || isPublic {
				itemID := ItemID(targetData["itemId"])
				quantity, _ := strconv.Atoi(targetData["quantity"])

				newInventory, err := AddItemToInventory(playerID, itemID, quantity)
				if err != nil {
					log.Printf("could not add item to inventory: %v", err)
					if strings.Contains(err.Error(), "inventory full") {
						notification := models.NotificationMessage{
							Type:    string(ServerEventNotification),
							Message: "Your inventory is full.",
						}
						PublishPrivately(playerID, notification)
					}
					return nil, nil
				}

				// Remove item from world
				CleanupEntity(interactData.EntityID, targetData)

				inventoryUpdateMsg := &models.InventoryUpdateMessage{
					Type:      string(ServerEventInventoryUpdate),
					Inventory: newInventory,
				}
				rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
				return nil, inventoryUpdateMsg
			} else {
				// Player cannot pick up the item, send a notification.
				notification := models.NotificationMessage{
					Type:    string(ServerEventNotification),
					Message: "You cannot pick up this item yet.",
				}
				PublishPrivately(playerID, notification)
			}
		}
	}

	// --- Existing Resource Interaction ---
	targetX, targetY := interactData.X, interactData.Y

	if !IsAdjacentOrDiagonal(currentX, currentY, targetX, targetY) {
		// Use ServerEventType constant
		return &models.StateCorrectionMessage{Type: string(ServerEventStateCorrection), X: currentX, Y: currentY}, nil
	}

	tile, props, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return nil, nil
	}
	originalTileType := tile.Type

	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	if TileType(tile.Type) == TileTypeSanctuaryStone {
		dialog := models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Alter Binding?",
			Text:    "Do you want to change your binding to this Sanctuary Stone? Your binding determines where you can teleport to and where you will respawn if you die.",
			Options: []models.DialogOption{
				{Text: "Yes", Action: "set_binding", Context: targetCoordKey},
				{Text: "No", Action: "close_dialog"},
			},
		}
		dialogJSON, _ := json.Marshal(dialog)
		sendDirectMessage(playerID, dialogJSON)
		return nil, nil
	}

	if !props.IsGatherable && !props.IsDestructible {
		return nil, nil
	}

	UpdateEntityDirection(playerID, targetX, targetY)

	tile.Health--
	damageMsg := models.ResourceDamagedMessage{
		Type:      string(ServerEventResourceDamaged), // Use ServerEventType constant
		X:         targetX,
		Y:         targetY,
		NewHealth: tile.Health,
	}
	PublishUpdate(damageMsg)

	var inventoryUpdateMsg *models.InventoryUpdateMessage
	if props.IsGatherable {
		newInventory, err := AddItemToInventory(playerID, props.GatherResource, 1)
		if err == nil {
			inventoryUpdateMsg = &models.InventoryUpdateMessage{
				Type:      string(ServerEventInventoryUpdate),
				Inventory: newInventory,
			}
			if props.GatherSkill != "" && props.GatherXP > 0 {
				AddExperience(playerID, props.GatherSkill, props.GatherXP)
			}

			// --- NEW: Quest Completion Check for Gathering ---
			CheckObjectives(playerID, models.ObjectiveGather, string(props.GatherResource))
			// --- END NEW ---
		} else if strings.Contains(err.Error(), "inventory full") {
			notification := models.NotificationMessage{
				Type:    string(ServerEventNotification),
				Message: "Your inventory is full.",
			}
			PublishPrivately(playerID, notification)
		}
	}

	if tile.Health <= 0 {
		groundTile := models.WorldTile{Type: string(TileTypeGround), Health: 0}
		worldUpdateMsg := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate),
			X:    targetX,
			Y:    targetY,
			Tile: groundTile,
		}
		PublishUpdate(worldUpdateMsg)

		if props.IsGatherable {
			member := originalTileType + ":" + targetCoordKey
			rdb.ZRem(ctx, string(RedisKeyResourcePositions), member)
		}

		if TileType(originalTileType) == TileTypeWoodenWall {
			log.Printf("Wall at %s destroyed, removing lock.", targetCoordKey)
			rdb.Del(ctx, string(RedisKeyLockTile)+targetCoordKey)
			rdb.SRem(ctx, string(RedisKeyActiveDecay), targetCoordKey)
		}

		newTileJSON, _ := json.Marshal(groundTile)
		rdb.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
	} else {
		newTileJSON, _ := json.Marshal(tile)
		rdb.HSet(ctx, string(RedisKeyWorldZone0), targetCoordKey, string(newTileJSON))
	}

	rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())

	return nil, inventoryUpdateMsg
}

