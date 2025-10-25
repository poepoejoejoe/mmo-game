package game

import "mmo-game/models"

// DialogCondition defines the requirements for a dialog node to be shown to the player.
type DialogCondition struct {
	RequiredCompletedQuests  []models.QuestID
	RequiredActiveQuests     []models.QuestID
	ForbiddenCompletedQuests []models.QuestID
	ForbiddenActiveQuests    []models.QuestID
	IsQuestReadyToTurnIn     models.QuestID // Quest is active and all objectives are complete
}

// DialogNode represents a single piece of dialog from an NPC.
type DialogNode struct {
	Text      string
	Options   []models.DialogOption
	Condition DialogCondition
}

// Evaluate checks if the player's quest state meets the dialog conditions.
func (c *DialogCondition) Evaluate(pq *models.PlayerQuests) bool {
	for _, questID := range c.RequiredCompletedQuests {
		if completed, ok := pq.CompletedQuests[questID]; !ok || !completed {
			return false
		}
	}
	for _, questID := range c.RequiredActiveQuests {
		if _, ok := pq.Quests[questID]; !ok {
			return false
		}
	}
	for _, questID := range c.ForbiddenCompletedQuests {
		if completed, ok := pq.CompletedQuests[questID]; ok && completed {
			return false
		}
	}
	for _, questID := range c.ForbiddenActiveQuests {
		if _, ok := pq.Quests[questID]; ok {
			return false
		}
	}

	if c.IsQuestReadyToTurnIn != "" {
		quest, ok := pq.Quests[c.IsQuestReadyToTurnIn]
		if !ok || !quest.IsComplete {
			return false
		}
	}

	return true
}

// WizardDialogTree holds the ordered list of dialog nodes for the Wizard.
// The first node whose conditions are met will be displayed.
var WizardDialogTree = []DialogNode{
	// --- Quest Turn-ins ---
	{
		Text:      "You've done it! You're a natural builder. Here, take this slice of pizza for your efforts! Perhaps you could help me with something else?",
		Options:   []models.DialogOption{{Text: "Thank you!", Action: "turn_in_build_a_wall"}, {Text: "Not right now.", Action: "close_dialog"}},
		Condition: DialogCondition{IsQuestReadyToTurnIn: models.QuestBuildAWall},
	},
	{
		Text:      "Ah, magnificent! The cooked rat meat smells... pungent. Exactly what I need for my research! You've done a great service to science today.",
		Options:   []models.DialogOption{{Text: "Glad I could help.", Action: "turn_in_rat_problem"}},
		Condition: DialogCondition{IsQuestReadyToTurnIn: models.QuestRatProblem},
	},
	// --- Quest In-Progress ---
	{
		Text:      "You're back! Have you crafted and placed a wooden wall yet? The village needs fortifications!",
		Options:   []models.DialogOption{{Text: "I'm still working on it.", Action: "close_dialog"}},
		Condition: DialogCondition{RequiredActiveQuests: []models.QuestID{models.QuestBuildAWall}},
	},
	{
		Text:      "How goes the scientific ingredient gathering? Have you procured the cooked rat meat yet?",
		Options:   []models.DialogOption{{Text: "I'm on it.", Action: "close_dialog"}},
		Condition: DialogCondition{RequiredActiveQuests: []models.QuestID{models.QuestRatProblem}},
	},
	// --- Post-Quest & Quest Offers ---
	{
		Text:    "Your assistance has been invaluable. My research progresses, thanks to you!",
		Options: []models.DialogOption{{Text: "Happy to help the pursuit of knowledge.", Action: "close_dialog"}},
		Condition: DialogCondition{
			RequiredCompletedQuests: []models.QuestID{models.QuestBuildAWall, models.QuestRatProblem},
		},
	},
	{
		Text:    "Thank you again for your help with the wall! Actually, I have another little task for you, if you're up for it. It's a bit... unconventional.",
		Options: []models.DialogOption{{Text: "I'm listening.", Action: "quest_2_details"}, {Text: "Not right now.", Action: "close_dialog"}},
		Condition: DialogCondition{
			RequiredCompletedQuests:  []models.QuestID{models.QuestBuildAWall},
			ForbiddenActiveQuests:    []models.QuestID{models.QuestRatProblem},
			ForbiddenCompletedQuests: []models.QuestID{models.QuestRatProblem},
		},
	},
	// --- Default/Initial Dialog ---
	{
		Text:    "Greetings, traveler! I sense a spark of potential in you. Are you here to help an old wizard protect our village?",
		Options: []models.DialogOption{{Text: "Yes, tell me more.", Action: "quest_1_details"}, {Text: "Sorry, I'm busy.", Action: "close_dialog"}},
		Condition: DialogCondition{
			ForbiddenActiveQuests:    []models.QuestID{models.QuestBuildAWall, models.QuestRatProblem},
			ForbiddenCompletedQuests: []models.QuestID{models.QuestBuildAWall, models.QuestRatProblem},
		},
	},
}
