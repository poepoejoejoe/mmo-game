package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
)

func GetWizardDialog(playerID string) models.DialogMessage {
	playerQuests, _ := GetPlayerQuests(playerID)
	buildWallQuest := playerQuests.Quests[QuestBuildAWall]

	if buildWallQuest != nil && buildWallQuest.IsComplete {
		return models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Wizard",
			Text:    "You've done it! You're a natural builder. Here, take this slice of pizza for your efforts! Perhaps you could help me with something else?",
			Options: []models.DialogOption{
				{Text: "I'm ready for another quest!", Action: "accept_quest_2"}, // Placeholder
				{Text: "Not right now.", Action: "close_dialog"},
			},
		}
	} else if buildWallQuest != nil && !buildWallQuest.IsComplete {
		return models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Wizard",
			Text:    "You're back! Have you crafted and placed a wooden wall yet? The village needs fortifications!",
			Options: []models.DialogOption{
				{Text: "I'm still working on it.", Action: "close_dialog"},
			},
		}
	} else {
		return models.DialogMessage{
			Type:    string(ServerEventShowDialog),
			NpcName: "Wizard",
			Text:    "Greetings, traveler! I sense a spark of potential in you. Are you here to help an old wizard protect our village?",
			Options: []models.DialogOption{
				{Text: "Yes, tell me more.", Action: "quest_1_details"},
				{Text: "Sorry, I'm busy.", Action: "close_dialog"},
			},
		}
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
	case "accept_quest_build_a_wall":
		playerQuests, err := GetPlayerQuests(playerID)
		if err != nil {
			log.Printf("Error getting player quests: %v", err)
			return nil
		}
		playerQuests.StartQuest(QuestBuildAWall)
		SavePlayerQuests(playerID, playerQuests)

		notification := models.NotificationMessage{
			Type:    string(ServerEventNotification),
			Message: "Quest Accepted: A Sturdy Defense",
		}
		notificationJSON, _ := json.Marshal(notification)
		sendDirectMessage(playerID, notificationJSON)
	}
	return nil
}
