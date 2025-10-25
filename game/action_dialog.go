package game

import (
	"encoding/json"
	"mmo-game/models"
)

func ProcessDialogAction(playerID string, payload json.RawMessage) {
	var dialogAction models.DialogActionPayload
	if err := json.Unmarshal(payload, &dialogAction); err != nil {
		return
	}

	// For now, we only have wizard dialogs. A more robust system would check the context of the dialog.
	newDialog := HandleWizardDialogAction(playerID, dialogAction.Action)

	if newDialog != nil {
		dialogJSON, _ := json.Marshal(newDialog)
		sendDirectMessage(playerID, dialogJSON)
	}
}
