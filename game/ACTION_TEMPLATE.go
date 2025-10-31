package game

import (
	"encoding/json"
	"log"
	"time"
)

// ExampleActionHandler demonstrates the standard pattern for implementing action handlers.
// This file serves as a template for creating new actions.
//
// To create a new action handler:
// 1. Copy this file and rename it to action_<action_name>_handler.go
// 2. Replace "Example" with your action name throughout the file
// 3. Implement the Process method with your action logic
// 4. Register the handler in action_registry_init.go
// 5. Update handlers.go to use the registry (or remove the old switch case)
type ExampleActionHandler struct{}

// Process handles an example action request from the client.
//
// This method follows the standard action handler pattern:
// 1. Unmarshal the payload into a typed struct
// 2. Validate the action (check cooldowns, permissions, etc.)
// 3. Perform the action logic
// 4. Update game state (Redis, etc.)
// 5. Create and return an ActionResult with messages to send
//
// Parameters:
//   - playerID: The ID of the player performing the action
//   - payload: The raw JSON payload from the client
//
// Returns:
//   - *ActionResult: Contains messages to send to the player and/or broadcast to all players.
//     Return Failed() if the action is invalid or should be silently ignored.
func (h *ExampleActionHandler) Process(playerID string, payload json.RawMessage) *ActionResult {
	// Step 1: Unmarshal the payload
	// Replace models.ExamplePayload with your actual payload type from models package
	// Example: var exampleData models.MovePayload
	// For this template, we'll use a generic map to demonstrate
	var exampleData map[string]interface{}
	if err := json.Unmarshal(payload, &exampleData); err != nil {
		// Invalid payload format - silently fail
		return Failed()
	}

	// Step 2: Validate the action
	// Check if the entity can act (cooldown, health, etc.)
	canAct, entityData := CanEntityAct(playerID)
	if !canAct {
		// Entity is on cooldown or dead - silently fail
		return Failed()
	}

	// Add any additional validation here
	// Example: Check if player has required items, is in correct location, etc.
	_, _ = GetEntityPosition(entityData) // Get player position for validation
	// ... validation logic ...

	// Step 3: Perform the action logic
	// This is where your game logic goes
	// Example: Consume items, deal damage, update state, etc.

	// Step 4: Update game state in Redis
	// Use Redis pipelines for atomic operations when updating multiple keys
	pipe := rdb.Pipeline()
	
	// Example Redis operations:
	// pipe.HSet(ctx, playerID, "someField", someValue)
	// pipe.HIncrBy(ctx, someKey, "someField", amount)
	
	// Execute the pipeline
	_, err := pipe.Exec(ctx)
	if err != nil {
		log.Printf("Redis error during example action for player %s: %v", playerID, err)
		return Failed()
	}

	// Step 5: Set action cooldown
	nextActionTime := time.Now().Add(BaseActionCooldown).UnixMilli()
	rdb.HSet(ctx, playerID, "nextActionAt", nextActionTime)

	// Step 6: Create result messages
	result := NewActionResult()

	// Add messages to send to the player (private updates)
	// Example: Inventory updates, health changes, etc.
	// Get inventory from your logic:
	// finalInventory, _ := GetInventory(playerID)
	// inventoryUpdate := &models.InventoryUpdateMessage{
	//     Type:      string(ServerEventInventoryUpdate),
	//     Inventory: finalInventory,
	// }
	// inventoryJSON, _ := json.Marshal(inventoryUpdate)
	// result.AddToPlayer(models.WebSocketMessage{
	//     Type:    inventoryUpdate.Type,
	//     Payload: inventoryJSON,
	// })

	// Add messages to broadcast to all players (world updates)
	// Example: Entity movements, world changes, etc.
	// worldUpdate := models.WorldUpdateMessage{
	//     Type: string(ServerEventWorldUpdate),
	//     X:    x,
	//     Y:    y,
	//     Tile: newTile,
	// }
	// worldJSON, _ := json.Marshal(worldUpdate)
	// result.AddToBroadcast(models.WebSocketMessage{
	//     Type:    worldUpdate.Type,
	//     Payload: worldJSON,
	// })

	// Alternatively, if you need to broadcast immediately (for real-time updates),
	// you can use PublishUpdate() directly instead of adding to ToBroadcast.
	// The handler will route ToBroadcast messages, but for immediate world updates,
	// PublishUpdate() is often more appropriate.
	// PublishUpdate(someWorldUpdate)

	log.Printf("Player %s performed example action successfully", playerID)
	return result
}

// Common patterns for action handlers:
//
// 1. Checking if player has an item:
//    if !HasItemInInventory(playerID, ItemID("some_item"), 1) {
//        return Failed()
//    }
//
// 2. Consuming items from inventory:
//    RemoveItemFromInventory(playerID, ItemID("some_item"), 1)
//
// 3. Adding items to inventory:
//    AddItemToInventory(playerID, ItemID("some_item"), 1)
//
// 4. Checking if player is adjacent to a position:
//    if !IsAdjacent(playerX, playerY, targetX, targetY) {
//        return Failed()
//    }
//
// 5. Sending notifications to the player:
//    notification := models.NotificationMessage{
//        Type:    string(ServerEventNotification),
//        Message: "Your action message here",
//    }
//    PublishPrivately(playerID, notification)
//
// 6. Broadcasting world updates:
//    PublishUpdate(worldUpdateMessage)
//
// 7. Sending direct messages (for immediate client updates):
//    sendDirectMessage(playerID, messageJSON)
//
// 8. Checking quest objectives:
//    CheckObjectives(playerID, models.ObjectiveCraft, itemID)
//
// 9. Adding experience:
//    AddExperience(playerID, models.SkillAttack, 10.0)

