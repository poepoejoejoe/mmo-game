package game

import (
	"encoding/json"
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

