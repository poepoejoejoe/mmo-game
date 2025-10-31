# Action System Documentation

## Overview

The action system provides a standardized way to handle client actions in the game. All actions follow a consistent pattern, making it easy to add new actions and understand existing ones.

## Architecture

### Components

1. **ActionHandler Interface** (`game/action_registry.go`)
   - Defines the standard interface all actions must implement
   - Single `Process()` method that takes playerID and payload

2. **ActionResult** (`game/action_response.go`)
   - Standardized return type for all actions
   - Separates messages for the player vs. broadcasts to all players
   - Clear success/failure indication

3. **ActionRegistry** (`game/action_registry.go`)
   - Maps client event types to their handlers
   - Enables automatic routing without giant switch statements
   - Handlers registered via `RegisterAction()` in `init()` functions

4. **Action Handlers** (`game/action_*_handler.go`)
   - Each action has its own handler struct implementing `ActionHandler`
   - Follows consistent pattern for validation, logic, and messaging

## Creating a New Action

### Step 1: Create the Handler File

Create a new file `game/action_<action_name>_handler.go` based on `ACTION_TEMPLATE.go`:

```go
package game

import (
	"encoding/json"
	"mmo-game/models"
)

type MyActionHandler struct{}

func (h *MyActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	// Your action logic here
}
```

### Step 2: Implement the Process Method

Follow this pattern:

1. **Unmarshal payload** - Parse the JSON into your payload struct
2. **Validate** - Check cooldowns, permissions, prerequisites
3. **Perform logic** - Execute the game logic
4. **Update state** - Modify Redis/game state atomically
5. **Create messages** - Build ActionResult with messages to send

### Step 3: Register the Handler

Add to `game/action_registry_init.go`:

```go
RegisterAction(ClientEventMyAction, &MyActionHandler{})
```

### Step 4: Update handlers.go

Replace the switch case with registry lookup:

```go
case game.ClientEventMyAction:
	result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
	if result != nil && result.Success {
		for _, msg := range result.ToPlayer {
			msgJSON, _ := json.Marshal(msg)
			c.send <- msgJSON
		}
	}
```

### Step 5: Define the Payload Type

If needed, add to `models/models.go`:

```go
type MyActionPayload struct {
	Field1 string `json:"field1"`
	Field2 int    `json:"field2"`
}
```

## Common Patterns

### Validation

```go
// Check if entity can act (cooldown, health)
canAct, entityData := CanEntityAct(playerID)
if !canAct {
	return Failed()
}

// Check if player has item
if !HasItemInInventory(playerID, ItemID("item"), 1) {
	return Failed()
}

// Check adjacency
if !IsAdjacent(playerX, playerY, targetX, targetY) {
	return Failed()
}
```

### Updating State

```go
// Use pipelines for atomic operations
pipe := rdb.Pipeline()
pipe.HSet(ctx, playerID, "field", value)
pipe.HIncrBy(ctx, key, "field", amount)
_, err := pipe.Exec(ctx)
if err != nil {
	return Failed()
}

// Set cooldown
nextActionTime := time.Now().Add(BaseActionCooldown).UnixMilli()
rdb.HSet(ctx, playerID, "nextActionAt", nextActionTime)
```

### Creating Messages

```go
result := NewActionResult()

// Private message to player
inventoryUpdate := &models.InventoryUpdateMessage{
	Type:      string(ServerEventInventoryUpdate),
	Inventory: inventory,
}
inventoryJSON, _ := json.Marshal(inventoryUpdate)
result.AddToPlayer(models.WebSocketMessage{
	Type:    inventoryUpdate.Type,
	Payload: inventoryJSON,
})

// Broadcast to all players (or use PublishUpdate for immediate broadcast)
worldUpdate := models.WorldUpdateMessage{
	Type: string(ServerEventWorldUpdate),
	X:    x,
	Y:    y,
	Tile: tile,
}
worldJSON, _ := json.Marshal(worldUpdate)
result.AddToBroadcast(models.WebSocketMessage{
	Type:    worldUpdate.Type,
	Payload: worldJSON,
})

return result
```

### Error Handling

- Return `Failed()` for validation failures (silent failures)
- Log errors for debugging but still return `Failed()` for unexpected errors
- Don't send error messages to clients for validation failures (client should prevent these)

## Message Routing

### ToPlayer Messages
- Sent only to the player who performed the action
- Use for: inventory updates, health changes, private notifications
- Routed via `c.send` channel in handlers.go

### ToBroadcast Messages
- Sent to all players in the game
- Use for: world updates, entity movements, public events
- Currently routed via `PublishUpdate()` calls (consider refactoring to use registry)

### Direct Messages
- For immediate updates that need to bypass the registry
- Use `sendDirectMessage()` or `PublishPrivately()` directly
- Example: real-time world updates that need immediate propagation

## Migration Status

### Migrated Actions (Using Registry)
- ✅ Move (`MoveActionHandler`) - Simple movement handler
- ✅ Eat (`EatActionHandler`) - Item consumption and healing
- ✅ Attack (`AttackActionHandler`) - Combat with broadcasts
- ✅ Craft (`CraftActionHandler`) - Complex crafting with ingredient validation and special conditions
- ✅ Interact (`InteractActionHandler`) - Entity and tile interactions (NPCs, items, resources)
- ✅ Equip (`EquipActionHandler`) - Equipping items from inventory with slot swapping
- ✅ Unequip (`UnequipActionHandler`) - Unequipping items to inventory with space validation
- ✅ PlaceItem (`PlaceItemActionHandler`) - Placing items in the world (walls, fire, etc.)

### Pending Migration
- LearnRecipe
- SendChat
- DialogAction
- ToggleEcho
- SetRune
- Teleport
- FindPath
- DepositItem/WithdrawItem

## Best Practices

1. **Keep handlers focused** - Each handler should do one thing well
2. **Use existing helpers** - Leverage `CanEntityAct()`, `AddItemToInventory()`, etc.
3. **Atomic operations** - Use Redis pipelines for multi-key updates
4. **Silent failures** - Return `Failed()` for validation failures, don't log every invalid request
5. **Log important events** - Log successful actions and unexpected errors
6. **Document complex logic** - Add comments explaining why, not what
7. **Follow data-driven design** - Use constants from `definitions.go`, not magic strings

## Examples

See these files for reference implementations:
- `game/action_move_handler.go` - Simple movement handler
- `game/action_eat_handler.go` - Item consumption and healing
- `game/action_attack_handler.go` - Combat with broadcasts
- `game/action_craft_handler.go` - Complex crafting with validation
- `game/action_interact_handler.go` - Multi-purpose entity/tile interactions
- `game/action_equip_handler.go` - Equipping items with slot management
- `game/action_unequip_handler.go` - Unequipping items with inventory checks
- `game/action_place_item_handler.go` - Placing items with multiple item type support
- `game/ACTION_TEMPLATE.go` - Complete template with examples

