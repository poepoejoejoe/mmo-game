package game

import (
	"encoding/json"
	"log"
	"math/rand"
	"mmo-game/game/utils"
	"mmo-game/models"
	"time"
)

const decayTickInterval = 10 * time.Second

func StartDecaySystem() {
	ticker := time.NewTicker(decayTickInterval)
	defer ticker.Stop()

	for range ticker.C {
		handleDecay()
	}
}

func handleDecay() {
	worldData, err := rdb.HGetAll(ctx, string(RedisKeyWorldZone0)).Result()
	if err != nil {
		log.Printf("Failed to get world data for decay check: %v", err)
		return
	}

	for coordKey, tileJSON := range worldData {
		var tile models.WorldTile
		if err := json.Unmarshal([]byte(tileJSON), &tile); err != nil {
			continue
		}

		props, ok := TileDefs[TileType(tile.Type)]
		if !ok || !props.Decays {
			continue
		}

		// Calculate chance for this tick
		chanceForTick := props.DecayChancePerSecond * decayTickInterval.Seconds()

		if rand.Float64() < chanceForTick {
			// Apply decay damage
			tile.Health -= props.DecayAmount
			if tile.Health < 0 {
				tile.Health = 0
			}

			x, y := utils.ParseCoordKey(coordKey)

			damageMsg := models.ResourceDamagedMessage{
				Type:      string(ServerEventResourceDamaged),
				X:         x,
				Y:         y,
				NewHealth: tile.Health,
			}
			PublishUpdate(damageMsg)

			if tile.Health <= 0 {
				// Tile is destroyed
				originalTileType := tile.Type
				tile.Type = string(TileTypeGround)
				groundTile := models.WorldTile{Type: string(TileTypeGround), Health: 0}
				worldUpdateMsg := models.WorldUpdateMessage{
					Type: string(ServerEventWorldUpdate),
					X:    x,
					Y:    y,
					Tile: groundTile,
				}
				PublishUpdate(worldUpdateMsg)

				if TileType(originalTileType) == TileTypeWoodenWall {
					log.Printf("Wall at %s decayed, removing lock.", coordKey)
					rdb.Del(ctx, string(RedisKeyLockTile)+coordKey)
				}
			}

			// Update tile in Redis
			newTileJSON, _ := json.Marshal(tile)
			rdb.HSet(ctx, string(RedisKeyWorldZone0), coordKey, string(newTileJSON))
		}
	}
}
