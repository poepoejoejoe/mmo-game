package game

import (
	"log"
	"strconv"
)

func ProcessToggleEcho(playerID string) {
	playerData, err := rdb.HGetAll(ctx, playerID).Result()
	if err != nil {
		log.Printf("Error getting player data for echo toggle %s: %v", playerID, err)
		return
	}

	isEcho, _ := strconv.ParseBool(playerData["isEcho"])
	resonance, _ := strconv.ParseInt(playerData["resonance"], 10, 64)

	if !isEcho && resonance <= 0 {
		// Can't activate echo without resonance
		return
	}

	log.Printf("Player %s toggled echo state to: %v", playerID, !isEcho)
	SetEchoState(playerID, !isEcho)
}
