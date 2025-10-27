package game

import (
	"encoding/json"
	"log"
)

type SetRunePayload struct {
	Rune string `json:"rune"`
}

func ProcessSetRune(playerID string, payload json.RawMessage) {
	var p SetRunePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		log.Printf("Error unmarshalling set rune payload: %v", err)
		return
	}

	// TODO: Validate that the player actually has this rune.
	// For now, we'll trust the client.

	rdb.HSet(ctx, playerID, "activeRune", p.Rune)
	log.Printf("Player %s set active rune to %s", playerID, p.Rune)

	// Send confirmation back to the client? Or just update on next state message?
	// For now, let's send a small update message.
	updateMsg := map[string]interface{}{
		"type":       "active_rune_update", // This is a new server event type
		"activeRune": p.Rune,
	}
	updateMsgJSON, _ := json.Marshal(updateMsg)
	if sendDirectMessage != nil {
		sendDirectMessage(playerID, updateMsgJSON)
	}
}
