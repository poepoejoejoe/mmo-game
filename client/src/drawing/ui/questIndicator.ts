/**
 * Quest Indicator Drawing
 * 
 * Draws animated quest indicators (! and ?) above entities.
 */

import { EntityState } from '../../types';
import { COLORS, ANIMATION, SIZE, TEXT } from '../../utils/drawingConstants';

export function drawQuestIndicator(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, time: number, questState: EntityState['questState']) {
    const centerX = x + tileSize / 2;
    const baseY = y - tileSize * SIZE.QUEST_Y_OFFSET;

    // Pulsing effect for size and brightness
    const pulse = Math.sin(time / ANIMATION.QUEST_PULSE_SPEED) * (ANIMATION.QUEST_PULSE_MAX - ANIMATION.QUEST_PULSE_MIN) + ANIMATION.QUEST_PULSE_MIN;

    const indicatorHeight = tileSize * SIZE.QUEST_HEIGHT_MULTIPLIER * pulse;

    // Position oscillates up and down slightly
    const bounce = Math.sin(time / ANIMATION.QUEST_BOUNCE_SPEED) * tileSize * ANIMATION.QUEST_BOUNCE_AMOUNT;
    const indicatorY = baseY - bounce;

    ctx.save();
    ctx.font = `bold ${indicatorHeight}px ${TEXT.FONT_FAMILY_DEFAULT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    let indicatorChar: string = TEXT.QUEST_AVAILABLE_CHAR;
    let indicatorColor: string = COLORS.TEXT_WHITE;

    switch (questState) {
        case 'available':
            indicatorColor = COLORS.QUEST_AVAILABLE;
            break;
        case 'in-progress':
            indicatorColor = COLORS.QUEST_IN_PROGRESS;
            break;
        case 'turn-in-ready':
            indicatorColor = COLORS.QUEST_TURN_IN_READY;
            indicatorChar = TEXT.QUEST_TURN_IN_CHAR;
            break;
    }

    // Shadow
    ctx.fillStyle = COLORS.SHADOW_BLACK_DARKER;
    ctx.fillText(indicatorChar, centerX + 2, indicatorY + 2);

    // Main Text
    ctx.fillStyle = indicatorColor;
    ctx.fillText(indicatorChar, centerX, indicatorY);

    ctx.restore();
}

