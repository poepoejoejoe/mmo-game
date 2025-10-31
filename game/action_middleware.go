package game

import (
	"encoding/json"
	"mmo-game/models"
	"time"
)

// ActionFunc is a function type that represents an action handler's core logic.
// It takes playerID and unmarshaled payload, and returns an ActionResult.
type ActionFunc func(playerID string, payload json.RawMessage) *ActionResult

// RequireCanAct wraps an action handler to ensure the entity can act before executing.
// This is a common validation pattern used by most actions.
//
// Usage:
//   handler := RequireCanAct(func(playerID string, payload json.RawMessage) *ActionResult {
//       // Your action logic here
//       return result
//   })
func RequireCanAct(action ActionFunc) ActionFunc {
	return func(playerID string, payload json.RawMessage) *ActionResult {
		canAct, _ := CanEntityAct(playerID)
		if !canAct {
			return Failed()
		}
		return action(playerID, payload)
	}
}

// WithActionCooldown wraps an action handler to automatically apply a cooldown after execution.
// The cooldown is only applied if the action succeeds.
//
// Usage:
//   handler := WithActionCooldown(BaseActionCooldown, func(playerID string, payload json.RawMessage) *ActionResult {
//       // Your action logic here
//       return result
//   })
func WithActionCooldown(cooldown time.Duration, action ActionFunc) ActionFunc {
	return func(playerID string, payload json.RawMessage) *ActionResult {
		result := action(playerID, payload)
		if result != nil && result.Success {
			nextActionTime := time.Now().Add(cooldown).UnixMilli()
			rdb.HSet(ctx, playerID, "nextActionAt", nextActionTime)
		}
		return result
	}
}

// RequirePayload unmarshals and validates the payload before executing the action.
// If unmarshaling fails, returns Failed().
//
// Usage:
//   handler := RequirePayload(func(playerID string, payload MyPayloadType) *ActionResult {
//       // Your action logic here, payload is already unmarshaled
//       return result
//   })
func RequirePayload[T any](action func(playerID string, payload T) *ActionResult) ActionFunc {
	return func(playerID string, rawPayload json.RawMessage) *ActionResult {
		var payload T
		if err := json.Unmarshal(rawPayload, &payload); err != nil {
			return Failed()
		}
		return action(playerID, payload)
	}
}

// RequireHasItem wraps an action handler to ensure the player has a required item.
// Returns Failed() if the player doesn't have the item or sufficient quantity.
//
// Usage:
//   handler := RequireHasItem(ItemWood, 10, func(playerID string, payload json.RawMessage) *ActionResult {
//       // Your action logic here
//       return result
//   })
func RequireHasItem(itemID ItemID, quantity int, action ActionFunc) ActionFunc {
	return func(playerID string, payload json.RawMessage) *ActionResult {
		if !HasItemInInventory(playerID, itemID, quantity) {
			return Failed()
		}
		return action(playerID, payload)
	}
}

// RequireHasItemInSlot wraps an action handler to ensure the player has a required item in a specific slot.
// Returns Failed() if the slot doesn't contain the item or sufficient quantity.
//
// Usage:
//   handler := RequireHasItemInSlot("slot_0", ItemWood, 5, func(playerID string, payload json.RawMessage) *ActionResult {
//       // Your action logic here
//       return result
//   })
func RequireHasItemInSlot(slotKey string, itemID ItemID, quantity int, action ActionFunc) ActionFunc {
	return func(playerID string, payload json.RawMessage) *ActionResult {
		inventoryKey := string(RedisKeyPlayerInventory) + playerID
		itemJSON, err := rdb.HGet(ctx, inventoryKey, slotKey).Result()
		if err != nil || itemJSON == "" {
			return Failed()
		}

		var item models.Item
		if err := json.Unmarshal([]byte(itemJSON), &item); err != nil {
			return Failed()
		}

		if item.ID != string(itemID) || item.Quantity < quantity {
			return Failed()
		}

		return action(playerID, payload)
	}
}

// RequireAdjacent wraps an action handler to ensure the target coordinates are adjacent to the player.
// The payload must contain X and Y fields for the target position.
//
// Usage:
//   handler := RequireAdjacent(func(playerID string, payload json.RawMessage) *ActionResult {
//       // Your action logic here - target is guaranteed to be adjacent
//       return result
//   })
func RequireAdjacent(action ActionFunc) ActionFunc {
	return func(playerID string, payload json.RawMessage) *ActionResult {
		playerX, playerY, err := getPlayerPosition(playerID)
		if err != nil {
			return Failed()
		}

		// Try to extract X and Y from payload (common pattern)
		var payloadData map[string]interface{}
		if err := json.Unmarshal(payload, &payloadData); err != nil {
			return Failed()
		}

		targetX, okX := payloadData["x"].(float64)
		targetY, okY := payloadData["y"].(float64)
		if !okX || !okY {
			return Failed()
		}

		if !IsAdjacent(playerX, playerY, int(targetX), int(targetY)) {
			return Failed()
		}

		return action(playerID, payload)
	}
}

// RequireInRange wraps an action handler to ensure the target is within a specified range.
// The payload must contain X and Y fields for the target position.
//
// Usage:
//   handler := RequireInRange(5, func(playerID string, payload json.RawMessage) *ActionResult {
//       // Your action logic here - target is guaranteed to be within range
//       return result
//   })
func RequireInRange(maxRange int, action ActionFunc) ActionFunc {
	return func(playerID string, payload json.RawMessage) *ActionResult {
		playerX, playerY, err := getPlayerPosition(playerID)
		if err != nil {
			return Failed()
		}

		// Try to extract X and Y from payload
		var payloadData map[string]interface{}
		if err := json.Unmarshal(payload, &payloadData); err != nil {
			return Failed()
		}

		targetX, okX := payloadData["x"].(float64)
		targetY, okY := payloadData["y"].(float64)
		if !okX || !okY {
			return Failed()
		}

		dx := playerX - int(targetX)
		if dx < 0 {
			dx = -dx
		}
		dy := playerY - int(targetY)
		if dy < 0 {
			dy = -dy
		}

		// Manhattan distance
		distance := dx + dy
		if distance > maxRange {
			return Failed()
		}

		return action(playerID, payload)
	}
}

// Chain wraps multiple action middlewares together.
// They are applied in order: the outer middleware wraps the inner one.
//
// Usage:
//   handler := Chain(
//       RequireCanAct,
//       RequireHasItem(ItemWood, 10),
//       WithActionCooldown(BaseActionCooldown),
//   )(myActionFunc)
func Chain(middlewares ...func(ActionFunc) ActionFunc) func(ActionFunc) ActionFunc {
	return func(action ActionFunc) ActionFunc {
		for i := len(middlewares) - 1; i >= 0; i-- {
			action = middlewares[i](action)
		}
		return action
	}
}

