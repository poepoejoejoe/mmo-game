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
	{
		Text:      "You made an axe! The trees are already looking less smug. Amazing work!",
		Options:   []models.DialogOption{{Text: "Happy to help.", Action: "turn_in_angry_trees"}},
		Condition: DialogCondition{IsQuestReadyToTurnIn: models.QuestAngryTrees},
	},
	{
		Text:      "The goop! It has a strange... resonance. I can teach you how to focus your will, to leave an Echo of yourself in the world when you depart. This will consume your built-up Resonance.",
		Options:   []models.DialogOption{{Text: "Amazing!", Action: "turn_in_a_lingering_will"}},
		Condition: DialogCondition{IsQuestReadyToTurnIn: "a_lingering_will"},
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
	{
		Text:      "Those trees won't chop themselves down! Have you crafted that crude axe yet?",
		Options:   []models.DialogOption{{Text: "Working on it.", Action: "close_dialog"}},
		Condition: DialogCondition{RequiredActiveQuests: []models.QuestID{models.QuestAngryTrees}},
	},
	{
		Text:      "I need that goop to study its strange properties. Have you gathered 10 globs yet?",
		Options:   []models.DialogOption{{Text: "I'm still gathering it.", Action: "close_dialog"}},
		Condition: DialogCondition{RequiredActiveQuests: []models.QuestID{"a_lingering_will"}},
	},
	// --- Post-Quest & Quest Offers ---
	{
		Text:    "Your assistance has been invaluable. My research progresses, thanks to you! I have one final task, a strange one, that might unlock a hidden potential within you.",
		Options: []models.DialogOption{{Text: "Tell me more.", Action: "quest_4_details"}, {Text: "I've had enough strange for one day.", Action: "close_dialog"}},
		Condition: DialogCondition{
			RequiredCompletedQuests:  []models.QuestID{models.QuestBuildAWall, models.QuestRatProblem, models.QuestAngryTrees},
			ForbiddenActiveQuests:    []models.QuestID{"a_lingering_will"},
			ForbiddenCompletedQuests: []models.QuestID{"a_lingering_will"},
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
	{
		Text:    "You've been a tremendous help, but I have... another problem. It's slightly embarrassing.",
		Options: []models.DialogOption{{Text: "What is it this time?", Action: "quest_3_details"}, {Text: "I'm not sure I want to know.", Action: "close_dialog"}},
		Condition: DialogCondition{
			RequiredCompletedQuests:  []models.QuestID{models.QuestRatProblem},
			ForbiddenActiveQuests:    []models.QuestID{models.QuestAngryTrees},
			ForbiddenCompletedQuests: []models.QuestID{models.QuestAngryTrees},
		},
	},
	// --- Default/Initial Dialog ---
	{
		Text:    "Greetings, traveler! I sense a spark of potential in you. Are you here to help an old wizard protect our village?",
		Options: []models.DialogOption{{Text: "Yes, tell me more.", Action: "quest_1_details"}, {Text: "Sorry, I'm busy.", Action: "close_dialog"}},
		Condition: DialogCondition{
			ForbiddenActiveQuests:    []models.QuestID{models.QuestBuildAWall, models.QuestRatProblem, models.QuestAngryTrees},
			ForbiddenCompletedQuests: []models.QuestID{models.QuestBuildAWall, models.QuestRatProblem, models.QuestAngryTrees},
		},
	},
}

// DialogPage represents a static piece of dialog that is not dependent on player state.
type DialogPage struct {
	Text    string
	Options []models.DialogOption
}

// WizardDialogPages holds the definitions for simple, static dialog pages shown to the player.
var WizardDialogPages = map[string]DialogPage{
	"quest_1_details": {
		Text: "The slimes and rats grow bolder. We need fortifications! Please, gather 10 wood, craft a wall, and place it to start our defenses.",
		Options: []models.DialogOption{
			{Text: "I will do it!", Action: "accept_quest_build_a_wall"},
			{Text: "That sounds like a lot of work.", Action: "close_dialog"},
		},
	},
	"quest_2_details": {
		Text: "Excellent! I'm working on a potion to better understand our enemies, a sort of... 'eau de vermin'. To complete it, I need the cooked meat of a giant rat. Could you slay one and cook its meat for me? For science!",
		Options: []models.DialogOption{
			{Text: "For science! I'll do it.", Action: "accept_quest_rat_problem"},
			{Text: "That's... odd. I'll pass.", Action: "close_dialog"},
		},
	},
	"quest_3_details": {
		Text: "So, the 'eau de vermin' worked a little TOO well. We have more rats than ever, and now they're chewing on the walls! I tried a simple repellent spell, but I might have... well, I seem to have accidentally granted sentience to the nearby trees. And they are NOT happy. To get more wood, you'll need a Crude Axe. You can make one with 10 wood, 10 stone, and 5 goop from the slimes.",
		Options: []models.DialogOption{
			{Text: "Angry trees? Of course. I'll do it.", Action: "accept_quest_angry_trees"},
			{Text: "You're on your own with this one.", Action: "close_dialog"},
		},
	},
	"quest_4_details": {
		Text: "I've noticed that the slime goop resonates with a person's life force. I believe if you gather enough of it, I can show you how to manifest an 'Echo' of yourself, a phantom that can linger in the world even when you are not focused on it. Bring me 10 globs of goop.",
		Options: []models.DialogOption{
			{Text: "A phantom of myself? I'm in.", Action: "accept_quest_a_lingering_will"},
			{Text: "That sounds... creepy. No thanks.", Action: "close_dialog"},
		},
	},
}

// QuestAcceptAction defines the properties for a quest-accepting action.
type QuestAcceptAction struct {
	QuestID      models.QuestID
	Notification string
}

// QuestAcceptActions maps action strings to their quest acceptance definitions.
var QuestAcceptActions = map[string]QuestAcceptAction{
	"accept_quest_build_a_wall": {
		QuestID:      models.QuestBuildAWall,
		Notification: "Quest Accepted: A Sturdy Defense",
	},
	"accept_quest_rat_problem": {
		QuestID:      models.QuestRatProblem,
		Notification: "Quest Accepted: A Culinary Conundrum",
	},
	"accept_quest_angry_trees": {
		QuestID:      models.QuestAngryTrees,
		Notification: "Quest Accepted: A-bewood-ing Problem",
	},
	"accept_quest_a_lingering_will": {
		QuestID:      "a_lingering_will",
		Notification: "Quest Accepted: A Lingering Will",
	},
}

// QuestTurnInAction defines the properties for a quest turn-in action.
type QuestTurnInAction struct {
	QuestID            models.QuestID
	RewardItem         ItemID
	RewardQuantity     int
	ItemToTake         ItemID
	ItemToTakeQuantity int
}

// QuestTurnInActions maps action strings to their quest turn-in definitions.
var QuestTurnInActions = map[string]QuestTurnInAction{
	"turn_in_build_a_wall": {
		QuestID:        models.QuestBuildAWall,
		RewardItem:     ItemSliceOfPizza,
		RewardQuantity: 1,
	},
	"turn_in_rat_problem": {
		QuestID:            models.QuestRatProblem,
		ItemToTake:         ItemCookedRatMeat,
		ItemToTakeQuantity: 1,
		RewardItem:         ItemSliceOfPizza,
		RewardQuantity:     1,
	},
	"turn_in_angry_trees": {
		QuestID:        models.QuestAngryTrees,
		RewardItem:     ItemSliceOfPizza,
		RewardQuantity: 1,
	},
	"turn_in_a_lingering_will": {
		QuestID:            "a_lingering_will",
		ItemToTake:         ItemGoop,
		ItemToTakeQuantity: 10,
	},
}
