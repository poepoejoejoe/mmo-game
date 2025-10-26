package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
)

func GetWizardDialog(playerID string) models.DialogMessage {
	playerQuests, _ := GetPlayerQuests(playerID)

	for _, node := range WizardDialogTree {
		if node.Condition.Evaluate(playerQuests) {
			return models.DialogMessage{
				Type:    string(ServerEventShowDialog),
				NpcName: "Wizard",
				Text:    node.Text,
				Options: node.Options,
			}
		}
	}

	// This should not be reached if the dialog tree has a default case
	return models.DialogMessage{
		Type:    string(ServerEventShowDialog),
		NpcName: "Wizard",
		Text:    "I'm sorry, I don't have anything to say to you right now.",
		Options: []models.DialogOption{{Text: "Goodbye", Action: "close_dialog"}},
	}
}

func HandleWizardDialogAction(playerID string, action string) *models.DialogMessage {
	// Handle static dialog pages
	if page, ok := WizardDialogPages[action]; ok {
		return &models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Wizard",
			Text:    page.Text,
			Options: page.Options,
		}
	}

	// Handle quest acceptance
	if questAction, ok := QuestAcceptActions[action]; ok {
		playerQuests, err := GetPlayerQuests(playerID)
		if err != nil {
			log.Printf("Error getting player quests: %v", err)
			return nil
		}
		StartQuest(playerQuests, questAction.QuestID)
		SavePlayerQuests(playerID, playerQuests)

		notification := models.NotificationMessage{
			Type:    string(ServerEventNotification),
			Message: questAction.Notification,
		}
		notificationJSON, _ := json.Marshal(notification)
		sendDirectMessage(playerID, notificationJSON)

		npcUpdateMsg := models.NpcQuestStateUpdateMessage{
			Type:       string(ServerEventNpcQuestStateUpdate),
			NpcName:    "wizard", // For now, this is the only quest giver
			QuestState: "in-progress",
		}
		npcUpdateJSON, _ := json.Marshal(npcUpdateMsg)
		sendDirectMessage(playerID, npcUpdateJSON)

		return nil
	}

	// Handle quest turn-ins
	if turnInAction, ok := QuestTurnInActions[action]; ok {
		playerQuests, err := GetPlayerQuests(playerID)
		if err != nil {
			log.Printf("Error getting player quests: %v", err)
			return nil
		}

		// Take quest item if specified
		if turnInAction.ItemToTake != "" {
			RemoveItemFromInventory(playerID, turnInAction.ItemToTake, turnInAction.ItemToTakeQuantity)
		}

		// Give reward
		var newInventory map[string]models.Item
		if turnInAction.RewardItem != "" {
			newInventory, _ = AddItemToInventory(playerID, turnInAction.RewardItem, turnInAction.RewardQuantity)
		}

		// Mark quest as completed
		MarkQuestAsCompleted(playerQuests, turnInAction.QuestID)
		SavePlayerQuests(playerID, playerQuests)

		if turnInAction.QuestID == "a_lingering_will" {
			rdb.HSet(ctx, playerID, "echoUnlocked", "true")
			log.Printf("Player %s has unlocked the Echo ability.", playerID)
		}

		// After all server-side changes, send the final inventory state to the client
		if newInventory != nil {
			inventoryUpdateMsg := models.InventoryUpdateMessage{
				Type:      string(ServerEventInventoryUpdate),
				Inventory: newInventory,
			}
			inventoryUpdateJSON, _ := json.Marshal(inventoryUpdateMsg)
			sendDirectMessage(playerID, inventoryUpdateJSON)
		}

		// Finally, update the NPC's quest indicator state based on the new quest statuses
		var newQuestState string
		if IsQuestReadyToTurnInToWizard(playerID) {
			newQuestState = "turn-in-ready"
		} else if HasActiveQuestFromWizard(playerID) {
			newQuestState = "in-progress"
		} else if CanAcceptAnyQuestFromWizard(playerID) {
			newQuestState = "available"
		}

		npcUpdateMsg := models.NpcQuestStateUpdateMessage{
			Type:       string(ServerEventNpcQuestStateUpdate),
			NpcName:    "wizard",
			QuestState: newQuestState, // This will be "" if no conditions are met
		}
		npcUpdateJSON, _ := json.Marshal(npcUpdateMsg)
		sendDirectMessage(playerID, npcUpdateJSON)

		return nil
	}

	return nil
}
