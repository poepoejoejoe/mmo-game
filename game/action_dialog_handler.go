package game

import (
	"encoding/json"
	"mmo-game/models"
)

// DialogActionHandler handles client dialog action actions.
// This implements the ActionHandler interface for standardized action processing.
type DialogActionHandler struct{}

// Process handles a dialog action request from the client.
// It processes dialog actions like setting binding or wizard dialog responses.
func (h *DialogActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	var dialogAction models.DialogActionPayload
	if err := json.Unmarshal(payload, &dialogAction); err != nil {
		return Failed()
	}

	result := NewActionResult()

	if dialogAction.Action == "set_binding" {
		rdb.HSet(ctx, playerID, "binding", dialogAction.Context)

		notification := models.NotificationMessage{
			Type:    string(ServerEventNotification),
			Message: "Your binding has been set to this Sanctuary Stone.",
		}
		notificationJSON, _ := json.Marshal(notification)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    notification.Type,
			Payload: notificationJSON,
		})
		return result
	}

	// For now, we only have wizard dialogs. A more robust system would check the context of the dialog.
	newDialog := HandleWizardDialogAction(playerID, dialogAction.Action)

	if newDialog != nil {
		dialogJSON, _ := json.Marshal(newDialog)
		result.AddToPlayer(models.WebSocketMessage{
			Type:    newDialog.Type,
			Payload: dialogJSON,
		})
	}

	return result
}

