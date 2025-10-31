package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
	"strconv"
	"strings"
	"time"
)

// InteractActionHandler handles client interact actions.
// This implements the ActionHandler interface for standardized action processing.
type InteractActionHandler struct{}

// Process handles an interact action request from the client.
// It can interact with entities (NPCs, items) or tiles (resources, sanctuary stones).
func (h *InteractActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var interactData models.InteractPayload
	if err := json.Unmarshal(payload, &interactData); err != nil {
		return Failed()
	}

	canAct, playerData := CanEntityAct(playerID)
	if !canAct {
		return Failed()
	}

	currentX, currentY := GetEntityPosition(playerData)
	result := NewActionResult()

	// Handle entity interaction (NPCs, items)
	if interactData.EntityID != "" {
		targetData, err := rdb.HGetAll(ctx, interactData.EntityID).Result()
		if err != nil || len(targetData) == 0 {
			return Failed()
		}

		entityType := targetData["entityType"]

		// NPC Interaction
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
				// Open bank window
				openBankMsg := map[string]interface{}{
					"type": string(ServerEventOpenBankWindow),
				}
				openBankJSON, _ := json.Marshal(openBankMsg)
				sendDirectMessage(playerID, openBankJSON)

				// Send initial bank state
				bankKey := "bank:" + playerID
				bankMsg := getBankUpdateMessage(bankKey)
				if bankMsg != nil {
					bankJSON, _ := json.Marshal(bankMsg)
					sendDirectMessage(playerID, bankJSON)
				}
			}
			// NPC interactions don't need state updates, just return success
			return result
		}

		// Item Pickup
		if entityType == string(EntityTypeItem) {
			targetX, _ := strconv.Atoi(targetData["x"])
			targetY, _ := strconv.Atoi(targetData["y"])

			if !IsWithinPickupRange(currentX, currentY, targetX, targetY) {
				correctionMsg := CreateStateCorrectionMessage(currentX, currentY)
				result.AddToPlayer(correctionMsg)
				return result
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
						notification := CreateNotificationMessage("Your inventory is full.")
						SendPrivately(playerID, notification)
					}
					return Failed()
				}

				// Remove item from world
				CleanupEntity(interactData.EntityID, targetData)

				// Send inventory update
				inventoryUpdateMsg := &models.InventoryUpdateMessage{
					Type:      string(ServerEventInventoryUpdate),
					Inventory: newInventory,
				}
				inventoryJSON, _ := json.Marshal(inventoryUpdateMsg)
				result.AddToPlayer(models.WebSocketMessage{
					Type:    inventoryUpdateMsg.Type,
					Payload: inventoryJSON,
				})

				rdb.HSet(ctx, playerID, "nextActionAt", time.Now().Add(BaseActionCooldown).UnixMilli())
				return result
			} else {
				// Player cannot pick up the item yet
				notification := CreateNotificationMessage("You cannot pick up this item yet.")
				SendPrivately(playerID, notification)
				return Failed()
			}
		}
	}

	// Handle tile interaction (resources, sanctuary stones)
	targetX, targetY := interactData.X, interactData.Y

	if !IsAdjacentOrDiagonal(currentX, currentY, targetX, targetY) {
		correctionMsg := CreateStateCorrectionMessage(currentX, currentY)
		result.AddToPlayer(correctionMsg)
		return result
	}

	tile, props, err := GetWorldTile(targetX, targetY)
	if err != nil {
		return Failed()
	}
	originalTileType := tile.Type
	targetCoordKey := strconv.Itoa(targetX) + "," + strconv.Itoa(targetY)

	// Sanctuary stone interaction
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
		return result
	}

	if !props.IsGatherable && !props.IsDestructible {
		return Failed()
	}

	UpdateEntityDirection(playerID, targetX, targetY)

	// Damage the tile
	tile.Health--
	damageMsg := models.ResourceDamagedMessage{
		Type:      string(ServerEventResourceDamaged),
		X:         targetX,
		Y:         targetY,
		NewHealth: tile.Health,
	}
	Broadcast(damageMsg)

	// Handle gathering
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
			CheckObjectives(playerID, models.ObjectiveGather, string(props.GatherResource))
		} else if strings.Contains(err.Error(), "inventory full") {
			notification := CreateNotificationMessage("Your inventory is full.")
			SendPrivately(playerID, notification)
		}
	}

	// Handle tile destruction
	if tile.Health <= 0 {
		groundTile := models.WorldTile{Type: string(TileTypeGround), Health: 0}
		worldUpdateMsg := models.WorldUpdateMessage{
			Type: string(ServerEventWorldUpdate),
			X:    targetX,
			Y:    targetY,
			Tile: groundTile,
		}
		Broadcast(worldUpdateMsg)

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

	// Send inventory update if we gathered something
	if inventoryUpdateMsg != nil {
		inventoryJSON, _ := json.Marshal(inventoryUpdateMsg)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    inventoryUpdateMsg.Type,
			Payload: inventoryJSON,
		})
	}

	return result
}

