/**
 * Drawing Registry Initialization
 * 
 * Automatically registers all drawing functions with the registry system.
 * This makes it easy to add new entities - just create the drawing function
 * and register it here, and it will be available throughout the system.
 */

import { registerEntityDraw, registerTileDraw, registerItemDraw } from './registry';
import { drawPlayer, drawWizard, drawItem, drawRat, drawSlime, drawGolemBanker } from './entities';
import { drawCrudeAxe } from './weapons';
import { drawRockTile, drawTree, drawSanctuaryStone, drawIronRockTile } from '../drawing';

/**
 * Initialize all drawing function registrations.
 * Call this once during application startup.
 */
export function initializeDrawingRegistry(): void {
    // Register entity drawing functions
    registerEntityDraw('player', drawPlayer);
    registerEntityDraw('wizard', drawWizard);
    registerEntityDraw('item', drawItem);
    registerEntityDraw('rat', drawRat);
    registerEntityDraw('slime', drawSlime);
    registerEntityDraw('golem_banker', drawGolemBanker);
    
    // Register tile drawing functions
    registerTileDraw('rock', drawRockTile);
    registerTileDraw('tree', drawTree);
    registerTileDraw('sanctuary_stone', drawSanctuaryStone);
    registerTileDraw('iron_rock', drawIronRockTile);
    
    // Register item drawing functions (for weapons/equipment)
    registerItemDraw('crude_axe', drawCrudeAxe);
}
