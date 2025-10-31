/**
 * Entities Layer
 * 
 * Renders all entities (players, NPCs, items) in the world.
 */

import { TILE_SIZE } from '../../constants';
import * as state from '../../state';
import { getEntityProperties } from '../../definitions';
import { drawQuestIndicator } from '../../drawing';
import { assetImages } from '../../renderer';
import { CHAT, OPACITY } from '../../utils/drawingConstants';
import { RenderParams } from '../layers';

export function renderEntities(ctx: CanvasRenderingContext2D, params: RenderParams): void {
    const allEntities = state.getState().entities;
    const myPlayerId = state.getState().playerId;

    // First pass: collect positions of golem banker and wizard NPCs
    const npcBlockingPositions = new Set<string>();
    for (const entityId in allEntities) {
        const entity = allEntities[entityId];
        if (entity.type === 'npc' && (entity.name === 'golem_banker' || entity.name === 'wizard')) {
            const posKey = `${entity.x},${entity.y}`;
            npcBlockingPositions.add(posKey);
        }
    }

    for (const entityId in allEntities) {
        const entity = allEntities[entityId];
        
        // Visibility Rule:
        if (entity.type === 'item') {
            if (entity.owner && entity.owner !== myPlayerId && entity.publicAt && Date.now() < entity.publicAt) {
                continue; // Skip rendering if it's owned by someone else and not yet public
            }
        }

        // Skip rendering players that are on the same position as a golem banker or wizard
        if (entity.type === 'player') {
            const posKey = `${entity.x},${entity.y}`;
            if (npcBlockingPositions.has(posKey)) {
                continue; // Skip rendering player if NPC is on the same position
            }
        }

        const screenX = (entity.x - params.startX) * TILE_SIZE;
        const screenY = (entity.y - params.startY) * TILE_SIZE;

        ctx.save();

        const tile = state.getTileData(entity.x, entity.y);
        const onSanctuary = tile && tile.isSanctuary;

        if (onSanctuary) {
            // Ethereal State (on sanctuary): Slight transparency.
            ctx.globalAlpha = OPACITY.SANCTUARY_ENTITY;
        }

        // Draw the entity (player, item, etc.)
        const props = getEntityProperties(entity.type, entity, myPlayerId);
        if (props.draw) {
            props.draw(ctx, screenX, screenY, TILE_SIZE, entity, params.time, assetImages, props);
        }

        ctx.restore();

        if (entity.questState) {
            drawQuestIndicator(ctx, screenX, screenY, TILE_SIZE, params.time, entity.questState);
        }

        // Render Chat Message
        if (entity.lastChatMessage && entity.lastChatTimestamp) {
            const timeSinceChat = Date.now() - entity.lastChatTimestamp;

            if (timeSinceChat < CHAT.DURATION) {
                const fadeAlpha = OPACITY.TEXT_FADE_MAX - (timeSinceChat / CHAT.DURATION) * (OPACITY.TEXT_FADE_MAX - OPACITY.TEXT_FADE_MIN);
                
                ctx.font = `${CHAT.FONT_SIZE}px ${CHAT.FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;

                // Simple word wrapping
                const words = entity.lastChatMessage.split(' ');
                let line = '';
                let yOffset = screenY - CHAT.Y_OFFSET;
                const lines = [];

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;
                    if (testWidth > CHAT.MAX_WIDTH && n > 0) {
                        lines.push(line);
                        line = words[n] + ' ';
                    } else {
                        line = testLine;
                    }
                }
                lines.push(line);
                
                // Draw the text lines, starting from the bottom up
                for (let i = lines.length - 1; i >= 0; i--) {
                    ctx.fillText(lines[i].trim(), screenX + TILE_SIZE / 2, yOffset);
                    yOffset -= CHAT.LINE_HEIGHT;
                }
            }
        }
    }
}

