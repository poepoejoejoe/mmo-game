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

	if dialogAction.Action == "set_binding" {
		rdb.HSet(ctx, playerID, "binding", dialogAction.Context)

		notification := models.NotificationMessage{
			Type:    string(ServerEventNotification),
			Message: "Your binding has been set to this Sanctuary Stone.",
		}
		notificationJSON, _ := json.Marshal(notification)
		sendDirectMessage(playerID, notificationJSON)
		return
	}

	// For now, we only have wizard dialogs. A more robust system would check the context of the dialog.
	newDialog := HandleWizardDialogAction(playerID, dialogAction.Action)

	if newDialog != nil {
		dialogJSON, _ := json.Marshal(newDialog)
		sendDirectMessage(playerID, dialogJSON)
	}
}
