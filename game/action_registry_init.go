package game

// init registers all action handlers with the ActionRegistry.
// This runs automatically when the game package is imported.
// To add a new action, create a handler struct that implements ActionHandler,
// then register it here with RegisterAction.
func init() {
	// Register action handlers
	// All actions have been migrated to use the registry system.
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
	RegisterAction(ClientEventSendChat, &SendChatActionHandler{})
	RegisterAction(ClientEventDialogAction, &DialogActionHandler{})
	RegisterAction(ClientEventDepositItem, &DepositItemActionHandler{})
	RegisterAction(ClientEventWithdrawItem, &WithdrawItemActionHandler{})
	RegisterAction(ClientEventReorderItem, &ReorderItemActionHandler{})
}

