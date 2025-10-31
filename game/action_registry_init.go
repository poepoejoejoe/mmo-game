package game

// init registers all action handlers with the ActionRegistry.
// This runs automatically when the game package is imported.
// To add a new action, create a handler struct that implements ActionHandler,
// then register it here with RegisterAction.
func init() {
	// Register action handlers
	// Currently migrated actions: Move, Eat, Attack, Craft, Interact
	// Other actions will be migrated gradually as needed.
	RegisterAction(ClientEventMove, &MoveActionHandler{})
	RegisterAction(ClientEventEat, &EatActionHandler{})
	RegisterAction(ClientEventAttack, &AttackActionHandler{})
	RegisterAction(ClientEventCraft, &CraftActionHandler{})
	RegisterAction(ClientEventInteract, &InteractActionHandler{})
	
	// TODO: Migrate remaining actions to use the registry:
	// - ClientEventEquip
	// - ClientEventUnequip
	// - ClientEventPlaceItem
	// - ClientEventLearnRecipe
	// - ClientEventSendChat
	// - ClientEventDialogAction
	// - ClientEventToggleEcho
	// - ClientEventSetRune
	// - ClientEventTeleport
	// - ClientEventFindPath
	// - ClientEventDepositItem
	// - ClientEventWithdrawItem
}

