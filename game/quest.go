package game

import (
	"encoding/json"
	"log"
	"mmo-game/models"
)

type QuestID string

const (
	QuestBuildAWall QuestID = "build_a_wall"
)

type QuestObjective struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Completed   bool   `json:"completed"`
}

type Quest struct {
	ID         QuestID          `json:"id"`
	Title      string           `json:"title"`
	Objectives []QuestObjective `json:"objectives"`
	IsComplete bool             `json:"is_complete"`
}

type PlayerQuests struct {
	Quests map[QuestID]*Quest `json:"quests"`
}

var QuestDefs = map[QuestID]Quest{
	QuestBuildAWall: {
		ID:    QuestBuildAWall,
		Title: "A Sturdy Defense",
		Objectives: []QuestObjective{
			{ID: "gather_wood", Description: "Gather 10 wood", Completed: false},
			{ID: "craft_wall", Description: "Craft a Wooden Wall", Completed: false},
			{ID: "place_wall", Description: "Place the Wooden Wall", Completed: false},
		},
		IsComplete: false,
	},
}

func GetPlayerQuests(playerID string) (*PlayerQuests, error) {
	questsJSON, err := rdb.HGet(ctx, playerID, "quests").Result()
	if err != nil {
		// If the key doesn't exist, create a new empty quest state
		if err.Error() == "redis: nil" {
			return &PlayerQuests{Quests: make(map[QuestID]*Quest)}, nil
		}
		return nil, err
	}

	var playerQuests PlayerQuests
	if err := json.Unmarshal([]byte(questsJSON), &playerQuests); err != nil {
		return nil, err
	}
	return &playerQuests, nil
}

func SavePlayerQuests(playerID string, quests *PlayerQuests) error {
	questsJSON, err := json.Marshal(quests)
	if err != nil {
		return err
	}
	return rdb.HSet(ctx, playerID, "quests", string(questsJSON)).Err()
}

func (pq *PlayerQuests) StartQuest(questID QuestID) {
	if _, exists := pq.Quests[questID]; !exists {
		questDefinition := QuestDefs[questID]
		newQuest := &Quest{
			ID:         questDefinition.ID,
			Title:      questDefinition.Title,
			Objectives: make([]QuestObjective, len(questDefinition.Objectives)),
			IsComplete: false,
		}
		// Copy objectives to avoid modifying the definition
		copy(newQuest.Objectives, questDefinition.Objectives)
		pq.Quests[questID] = newQuest
		log.Printf("Quest '%s' started for a player.", questID)
	}
}

func (pq *PlayerQuests) UpdateObjective(questID QuestID, objectiveID string, playerID string) {
	if quest, ok := pq.Quests[questID]; ok && !quest.IsComplete {
		objectiveCompleted := false
		for i, obj := range quest.Objectives {
			if obj.ID == objectiveID && !obj.Completed {
				quest.Objectives[i].Completed = true
				objectiveCompleted = true
				log.Printf("Objective '%s' for quest '%s' completed for player %s.", objectiveID, questID, playerID)
				break
			}
		}

		if objectiveCompleted {
			// Check if all objectives are now complete
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
				// Optionally, send a notification to the player
				notification := models.NotificationMessage{
					Type:    string(ServerEventNotification),
					Message: "Quest Complete: " + quest.Title,
				}
				notificationJSON, _ := json.Marshal(notification)
				sendDirectMessage(playerID, notificationJSON)

				// Give reward
				AddItemToInventory(playerID, ItemSliceOfPizza, 1)
			}
		}
	}
}
