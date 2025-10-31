/**
 * Item Entity Drawing
 * 
 * Handles rendering of dropped items on the ground.
 */

import { EntityState } from '../../types';
import { COLORS, SIZE, TEXT } from '../../utils/drawingConstants';
import { itemDefinitions } from '../../definitions';

export function drawItem(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, entity: EntityState, _time: number, assetImages: { [key: string]: HTMLImageElement }) {
    if (!entity.itemId) return;

    const itemDef = itemDefinitions[entity.itemId] || itemDefinitions['default'];

    if (itemDef.asset) {
        const img = assetImages[itemDef.asset];
        if (img) {
            const size = tileSize * SIZE.ITEM_SIZE_MULTIPLIER;
            const xOffset = (size - tileSize) / 2;
            const yOffset = (size - tileSize) / 2;
            ctx.drawImage(img, x - xOffset, y - yOffset, size, size);
            return;
        }
    }

    // Fallback to drawing the character
    ctx.fillStyle = itemDef.color || COLORS.TEXT_WHITE;
    ctx.font = `${tileSize * SIZE.ITEM_FONT_MULTIPLIER}px ${TEXT.FONT_FAMILY_PIXEL}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(itemDef.character, x + tileSize / 2, y + tileSize / 2);
}

