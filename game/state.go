package game

import (
	"time"
)

const (
	BaseActionCooldown = 100 * time.Millisecond
	WaterMovePenalty   = 500 * time.Millisecond
	WorldSize          = 200
	// REMOVED: WoodPerWall is now defined in the new recipe data structure.
)
