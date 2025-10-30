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
	decayingCoords, err := rdb.SMembers(ctx, string(RedisKeyActiveDecay)).Result()
	if err != nil {
		log.Printf("Failed to get active decay set: %v", err)
		return
	}

	for _, coordKey := range decayingCoords {
		x, y := utils.ParseCoordKey(coordKey)
		tile, props, err := GetWorldTile(x, y)
		if err != nil {
			// Tile doesn't exist anymore, remove from set
			rdb.SRem(ctx, string(RedisKeyActiveDecay), coordKey)
			continue
		}

		if !props.Decays {
			// This tile shouldn't be in the decay set, remove it.
			rdb.SRem(ctx, string(RedisKeyActiveDecay), coordKey)
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
				groundTile := models.WorldTile{Type: string(TileTypeGround), Health: 0}
				newTileJSON, _ := json.Marshal(groundTile)
				rdb.HSet(ctx, string(RedisKeyWorldZone0), coordKey, string(newTileJSON))

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
					rdb.SRem(ctx, string(RedisKeyActiveDecay), coordKey)
				}
			} else {
				// Update tile in Redis
				newTileJSON, _ := json.Marshal(tile)
				rdb.HSet(ctx, string(RedisKeyWorldZone0), coordKey, string(newTileJSON))
			}
		}
	}
}
