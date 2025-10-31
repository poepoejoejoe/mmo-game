/**
 * World Layer
 * 
 * Renders tiles (water, trees, rocks, etc.) that make up the game world.
 */

import { TILE_SIZE } from '../../constants';
import * as state from '../../state';
import { getTileProperties } from '../../definitions';
import { findTileGroups } from '../../grouper';
import { drawWaterGroup, crackImages } from '../../drawing';
import { assetImages } from '../../renderer';
import { RenderParams } from '../layers';

export function renderWorld(ctx: CanvasRenderingContext2D, params: RenderParams): void {
    const startXInt = Math.floor(params.startX);
    const startYInt = Math.floor(params.startY);
    const groups = findTileGroups(startXInt, startYInt, params.viewportWidthInt, params.viewportHeightInt);

    for (const group of groups) {
        if (group.type === 'water') {
            drawWaterGroup(ctx, group, params.startX, params.startY, TILE_SIZE, params.time);
        } else {
            // Fallback to drawing tile by tile for other types
            for (const tile of group.tiles) {
                const x = tile.x - params.startX;
                const y = tile.y - params.startY;

                const tileData = state.getTileData(tile.x, tile.y);
                const tileProps = getTileProperties(tileData.type);
                
                if (tileProps.draw) {
                    tileProps.draw(ctx, x, y, TILE_SIZE, tile.x, tile.y, params.time, tileData);
                } else if (tileProps.asset) {
                    let assetPath = tileProps.asset;
                    if (Array.isArray(assetPath)) {
                        assetPath = assetPath[(tile.x + tile.y) % assetPath.length];
                    }
                    const img = assetImages[assetPath];
                    if (img) {
                        ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }

                    if (tileProps.isDestructible && tileProps.maxHealth > 0 && tileData.health < tileProps.maxHealth) {
                        const damageRatio = 1 - (tileData.health / tileProps.maxHealth);
                        const crackIndex = Math.min(Math.floor(damageRatio * crackImages.length), crackImages.length - 1);
                        const crackImg = crackImages[crackIndex];
                        if (crackImg) {
                            ctx.drawImage(crackImg, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        }
                    }
                } else {
                    ctx.fillStyle = tileProps.color;
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}

