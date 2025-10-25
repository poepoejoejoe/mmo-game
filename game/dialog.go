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
	switch action {
	case "quest_1_details":
		return &models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Wizard",
			Text:    "The slimes and rats grow bolder. We need fortifications! Please, gather 10 wood, craft a wall, and place it to start our defenses.",
			Options: []models.DialogOption{
				{Text: "I will do it!", Action: "accept_quest_build_a_wall"},
				{Text: "That sounds like a lot of work.", Action: "close_dialog"},
			},
		}
	case "quest_2_details":
		return &models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Wizard",
			Text:    "Excellent! I'm working on a potion to better understand our enemies, a sort of... 'eau de vermin'. To complete it, I need the cooked meat of a giant rat. Could you slay one and cook its meat for me? For science!",
			Options: []models.DialogOption{
				{Text: "For science! I'll do it.", Action: "accept_quest_rat_problem"},
				{Text: "That's... odd. I'll pass.", Action: "close_dialog"},
			},
		}
	case "accept_quest_build_a_wall":
		playerQuests, err := GetPlayerQuests(playerID)
		if err != nil {
			log.Printf("Error getting player quests: %v", err)
			return nil
		}
		StartQuest(playerQuests, models.QuestBuildAWall)
		SavePlayerQuests(playerID, playerQuests)

		notification := models.NotificationMessage{
			Type:    string(ServerEventNotification),
			Message: "Quest Accepted: A Sturdy Defense",
		}
		notificationJSON, _ := json.Marshal(notification)
		sendDirectMessage(playerID, notificationJSON)
	case "accept_quest_rat_problem":
		playerQuests, err := GetPlayerQuests(playerID)
		if err != nil {
			log.Printf("Error getting player quests: %v", err)
			return nil
		}
		StartQuest(playerQuests, models.QuestRatProblem)
		SavePlayerQuests(playerID, playerQuests)

		notification := models.NotificationMessage{
			Type:    string(ServerEventNotification),
			Message: "Quest Accepted: A Culinary Conundrum",
		}
		notificationJSON, _ := json.Marshal(notification)
		sendDirectMessage(playerID, notificationJSON)
	case "turn_in_build_a_wall":
		playerQuests, err := GetPlayerQuests(playerID)
		if err != nil {
			log.Printf("Error getting player quests: %v", err)
			return nil
		}
		// Give reward
		newInventory, _ := AddItemToInventory(playerID, ItemSliceOfPizza, 1)

		// Remove quest from player data
		MarkQuestAsCompleted(playerQuests, models.QuestBuildAWall)
		// Save the quest changes, which also sends a quest update to the client
		SavePlayerQuests(playerID, playerQuests)

		// After all server-side changes, send the final inventory state to the client
		inventoryUpdateMsg := models.InventoryUpdateMessage{
			Type:      string(ServerEventInventoryUpdate),
			Inventory: newInventory,
		}
		inventoryUpdateJSON, _ := json.Marshal(inventoryUpdateMsg)
		sendDirectMessage(playerID, inventoryUpdateJSON)
	case "turn_in_rat_problem":
		playerQuests, err := GetPlayerQuests(playerID)
		if err != nil {
			log.Printf("Error getting player quests: %v", err)
			return nil
		}
		// Take quest item
		RemoveItemFromInventory(playerID, ItemCookedRatMeat, 1)

		// Give reward
		newInventory, _ := AddItemToInventory(playerID, ItemSliceOfPizza, 1)

		// Remove quest from player data
		MarkQuestAsCompleted(playerQuests, models.QuestRatProblem)
		// Save the quest changes, which also sends a quest update to the client
		SavePlayerQuests(playerID, playerQuests)

		// After all server-side changes, send the final inventory state to the client
		inventoryUpdateMsg := models.InventoryUpdateMessage{
			Type:      string(ServerEventInventoryUpdate),
			Inventory: newInventory,
		}
		inventoryUpdateJSON, _ := json.Marshal(inventoryUpdateMsg)
		sendDirectMessage(playerID, inventoryUpdateJSON)
	}
	return nil
}
