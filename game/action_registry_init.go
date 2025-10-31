package game

// init registers all action handlers with the ActionRegistry.
// This runs automatically when the game package is imported.
// To add a new action, create a handler struct that implements ActionHandler,
// then register it here with RegisterAction.
func init() {
	// Register action handlers
	// Currently migrated actions: Move, Eat, Attack, Craft, Interact, Equip, Unequip, PlaceItem, LearnRecipe, SetRune, FindPath, Teleport, ToggleEcho
	// Other actions will be migrated gradually as needed.
	RegisterAction(ClientEventMove, &MoveActionHandler{})
	RegisterAction(ClientEventEat, &EatActionHandler{})
	RegisterAction(ClientEventAttack, &AttackActionHandler{})
	RegisterAction(ClientEventCraft, &CraftActionHandler{})
	RegisterAction(ClientEventInteract, &InteractActionHandler{})
	RegisterAction(ClientEventEquip, &EquipActionHandler{})
	RegisterAction(ClientEventUnequip, &UnequipActionHandler{})
	RegisterAction(ClientEventPlaceItem, &PlaceItemActionHandler{})
	RegisterAction(ClientEventLearnRecipe, &LearnRecipeActionHandler{})
	RegisterAction(ClientEventSetRune, &SetRuneActionHandler{})
	RegisterAction(ClientEventFindPath, &FindPathActionHandler{})
	RegisterAction(ClientEventTeleport, &TeleportActionHandler{})
	RegisterAction(ClientEventToggleEcho, &ToggleEchoActionHandler{})
	
	// TODO: Migrate remaining actions to use the registry:
	// - ClientEventSendChat
	// - ClientEventDialogAction
	// - ClientEventDepositItem
	// - ClientEventWithdrawItem
}

