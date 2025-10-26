package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
)

var QuestDefs = map[models.QuestID]models.Quest{
	models.QuestBuildAWall: {
		ID:    models.QuestBuildAWall,
		Title: "A Sturdy Defense",
		Objectives: []models.QuestObjective{
			{Type: models.ObjectiveGather, Target: string(ItemWood), Description: "Gather 10 wood", RequiredCount: 10},
			{Type: models.ObjectiveCraft, Target: string(ItemWoodenWall), Description: "Craft a Wooden Wall"},
			{Type: models.ObjectivePlace, Target: string(ItemWoodenWall), Description: "Place the Wooden Wall"},
		},
		IsComplete: false,
	},
	models.QuestRatProblem: {
		ID:    models.QuestRatProblem,
		Title: "A Culinary Conundrum",
		Objectives: []models.QuestObjective{
			{Type: models.ObjectiveSlay, Target: "rat", Description: "Slay a giant rat"},
			{Type: models.ObjectiveCook, Target: string(ItemCookedRatMeat), Description: "Cook the rat meat"},
		},
		IsComplete: false,
	},
	models.QuestAngryTrees: {
		ID:    models.QuestAngryTrees,
		Title: "A-bewood-ing Problem",
		Objectives: []models.QuestObjective{
			{Type: models.ObjectiveCraft, Target: string(ItemCrudeAxe), Description: "Craft a Crude Axe"},
			{Type: models.ObjectiveEquip, Target: string(ItemCrudeAxe), Description: "Equip the Crude Axe"},
		},
		IsComplete: false,
	},
	"a_lingering_will": {
		ID:    "a_lingering_will",
		Title: "A Lingering Will",
		Objectives: []models.QuestObjective{
			{Type: models.ObjectiveGather, Target: string(ItemGoop), Description: "Gather 10 Goop", RequiredCount: 10},
		},
		IsComplete: false,
	},
}

func GetPlayerQuests(playerID string) (*models.PlayerQuests, error) {
	questsJSON, err := rdb.HGet(ctx, playerID, "quests").Result()
	if err != nil {
		// If the key doesn't exist, create a new empty quest state
		if err.Error() == "redis: nil" {
			return &models.PlayerQuests{
				Quests:          make(map[models.QuestID]*models.Quest),
				CompletedQuests: make(map[models.QuestID]bool),
			}, nil
		}
		return nil, err
	}

	var playerQuests models.PlayerQuests
	if err := json.Unmarshal([]byte(questsJSON), &playerQuests); err != nil {
		return nil, err
	}
	if playerQuests.Quests == nil {
		playerQuests.Quests = make(map[models.QuestID]*models.Quest)
	}
	if playerQuests.CompletedQuests == nil {
		playerQuests.CompletedQuests = make(map[models.QuestID]bool)
	}
	return &playerQuests, nil
}

func SavePlayerQuests(playerID string, quests *models.PlayerQuests) error {
	questsJSON, err := json.Marshal(quests)
	if err != nil {
		return err
	}

	questUpdateMsg := models.QuestUpdateMessage{
		Type:   string(ServerEventQuestUpdate),
		Quests: quests.Quests,
	}
	questUpdateJSON, _ := json.Marshal(questUpdateMsg)
	sendDirectMessage(playerID, questUpdateJSON)

	return rdb.HSet(ctx, playerID, "quests", string(questsJSON)).Err()
}

func StartQuest(pq *models.PlayerQuests, questID models.QuestID) {
	if _, exists := pq.Quests[questID]; !exists {
		questDefinition := QuestDefs[questID]
		newQuest := &models.Quest{
			ID:         questDefinition.ID,
			Title:      questDefinition.Title,
			Objectives: make([]models.QuestObjective, len(questDefinition.Objectives)),
			IsComplete: false,
		}
		// Copy objectives to avoid modifying the definition
		copy(newQuest.Objectives, questDefinition.Objectives)
		pq.Quests[questID] = newQuest
		log.Printf("Quest '%s' started for a player.", questID)
	}
}

func MarkQuestAsCompleted(pq *models.PlayerQuests, questID models.QuestID) {
	delete(pq.Quests, questID)
	if pq.CompletedQuests == nil {
		pq.CompletedQuests = make(map[models.QuestID]bool)
	}
	pq.CompletedQuests[questID] = true
	log.Printf("Quest '%s' marked as completed for a player.", questID)
}

func CheckObjectives(playerID string, objectiveType models.ObjectiveType, target string) {
	pq, err := GetPlayerQuests(playerID)
	if err != nil {
		log.Printf("Could not get player quests for objective check: %v", err)
		return
	}

	for questID, quest := range pq.Quests {
		if quest.IsComplete {
			continue
		}

		objectiveCompleted := false
		for i, obj := range quest.Objectives {
			if !obj.Completed && obj.Type == objectiveType && obj.Target == target {
				if obj.RequiredCount > 0 {
					quest.Objectives[i].Count++
					if quest.Objectives[i].Count >= obj.RequiredCount {
						quest.Objectives[i].Completed = true
						objectiveCompleted = true
					}
				} else {
					quest.Objectives[i].Completed = true
					objectiveCompleted = true
				}
				log.Printf("Objective '%s %s' for quest '%s' updated for player %s. Progress: %d/%d", objectiveType, target, questID, playerID, quest.Objectives[i].Count, obj.RequiredCount)
			}
		}

		if objectiveCompleted {
			// Check if the entire quest is now complete
			allComplete := true
			for _, obj := range quest.Objectives {
				if !obj.Completed {
					allComplete = false
					break
				}
			}

			if allComplete {
				quest.IsComplete = true
				log.Printf("Quest '%s' completed for player %s.", questID, playerID)

				// Send a notification to the player
				notification := models.NotificationMessage{
					Type:    string(ServerEventNotification),
					Message: "Quest Complete: " + quest.Title,
				}
				notificationJSON, _ := json.Marshal(notification)
				sendDirectMessage(playerID, notificationJSON)

				// Update the NPC's quest state indicator
				npcUpdateMsg := models.NpcQuestStateUpdateMessage{
					Type:       string(ServerEventNpcQuestStateUpdate),
					NpcName:    "wizard",
					QuestState: "turn-in-ready",
				}
				npcUpdateJSON, _ := json.Marshal(npcUpdateMsg)
				sendDirectMessage(playerID, npcUpdateJSON)
			}
		}
	}
	SavePlayerQuests(playerID, pq)
}

// CanAcceptAnyQuestFromWizard checks if a player can accept any quest from the wizard.
func CanAcceptAnyQuestFromWizard(playerID string) bool {
	pq, err := GetPlayerQuests(playerID)
	if err != nil {
		log.Printf("Error getting player quests for %s: %v", playerID, err)
		return false
	}

	for _, node := range WizardDialogTree {
		// Check if this dialog node offers a quest
		isQuestOfferNode := false
		for _, option := range node.Options {
			if page, ok := WizardDialogPages[option.Action]; ok {
				for _, pageOption := range page.Options {
					if _, ok := QuestAcceptActions[pageOption.Action]; ok {
						isQuestOfferNode = true
						break
					}
				}
			}
			if isQuestOfferNode {
				break
			}
		}

		if isQuestOfferNode {
			if node.Condition.Evaluate(pq) {
				return true
			}
		}
	}

	return false
}

func HasActiveQuestFromWizard(playerID string) bool {
	pq, err := GetPlayerQuests(playerID)
	if err != nil {
		log.Printf("Error getting player quests for %s: %v", playerID, err)
		return false
	}

	for _, node := range WizardDialogTree {
		if node.Condition.IsQuestReadyToTurnIn != "" {
			continue // Skip turn-in nodes
		}

		if len(node.Condition.RequiredActiveQuests) > 0 {
			if node.Condition.Evaluate(pq) {
				return true
			}
		}
	}

	return false
}

func IsQuestReadyToTurnInToWizard(playerID string) bool {
	pq, err := GetPlayerQuests(playerID)
	if err != nil {
		log.Printf("Error getting player quests for %s: %v", playerID, err)
		return false
	}

	for _, node := range WizardDialogTree {
		if node.Condition.IsQuestReadyToTurnIn != "" {
			if node.Condition.Evaluate(pq) {
				return true
			}
		}
	}

	return false
}
