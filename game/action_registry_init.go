package game

// init registers all action handlers with the ActionRegistry.
// This runs automatically when the game package is imported.
// To add a new action, create a handler struct that implements ActionHandler,
// then register it here with RegisterAction.
func init() {
	// Register action handlers
	// Currently migrated actions: Move, Eat, Attack, Craft, Interact, Equip, Unequip, PlaceItem
	// Other actions will be migrated gradually as needed.
	RegisterAction(ClientEventMove, &MoveActionHandler{})
	RegisterAction(ClientEventEat, &EatActionHandler{})
	RegisterAction(ClientEventAttack, &AttackActionHandler{})
	RegisterAction(ClientEventCraft, &CraftActionHandler{})
	RegisterAction(ClientEventInteract, &InteractActionHandler{})
	RegisterAction(ClientEventEquip, &EquipActionHandler{})
	RegisterAction(ClientEventUnequip, &UnequipActionHandler{})
	RegisterAction(ClientEventPlaceItem, &PlaceItemActionHandler{})
	
	// TODO: Migrate remaining actions to use the registry:
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

