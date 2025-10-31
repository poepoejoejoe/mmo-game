/**
 * Drawing Registry Initialization
 * 
 * Automatically registers all drawing functions with the registry system.
 * This makes it easy to add new entities - just create the drawing function
 * and register it here, and it will be available throughout the system.
 */

import { registerEntityDraw, registerTileDraw, registerItemDraw, EntityDrawFunction } from './registry';
import { drawPlayer, drawWizard, drawItem, drawRat, drawSlime, drawGolemBanker } from './entities';
import { drawCrudeAxe } from './weapons';
import { drawRockTile, drawTree, drawSanctuaryStone, drawIronRockTile } from '../drawing/tiles';

/**
 * Initialize all drawing function registrations.
 * Call this once during application startup.
 */
export function initializeDrawingRegistry(): void {
    // Register entity drawing functions
    // Wrap functions to match the expected signature
    registerEntityDraw('player', drawPlayer as EntityDrawFunction);
    registerEntityDraw('wizard', ((ctx, x, y, tileSize) => {
        drawWizard(ctx, x, y, tileSize);
    }) as EntityDrawFunction);
    registerEntityDraw('item', drawItem as EntityDrawFunction);
    registerEntityDraw('rat', ((ctx, x, y, tileSize, entity, time) => {
        drawRat(ctx, x, y, tileSize, entity, time);
    }) as EntityDrawFunction);
    registerEntityDraw('slime', drawSlime as EntityDrawFunction);
    registerEntityDraw('golem_banker', drawGolemBanker as EntityDrawFunction);
    
    // Register tile drawing functions
    registerTileDraw('rock', drawRockTile);
    registerTileDraw('tree', drawTree);
    registerTileDraw('sanctuary_stone', drawSanctuaryStone);
    registerTileDraw('iron_rock', drawIronRockTile);
    
    // Register item drawing functions (for weapons/equipment)
    registerItemDraw('crude_axe', drawCrudeAxe);
}
