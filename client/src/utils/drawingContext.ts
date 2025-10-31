/**
 * Drawing Context Interface
 * 
 * Standardized context object passed to all drawing functions.
 * This makes it much easier for LLMs to understand what parameters are available
 * and creates consistency across all drawing functions.
 */

import { EntityState } from '../types';
import { EntityProperties } from '../types';

export interface DrawingContext {
    /** Canvas rendering context */
    ctx: CanvasRenderingContext2D;
    
    /** X position on screen (in pixels) */
    x: number;
    
    /** Y position on screen (in pixels) */
    y: number;
    
    /** Size of a tile in pixels */
    tileSize: number;
    
    /** Current game time (for animations) */
    time: number;
    
    /** Loaded asset images */
    assetImages: { [key: string]: HTMLImageElement };
    
    /** Entity being drawn (if drawing an entity) */
    entity?: EntityState;
    
    /** Entity properties (if drawing an entity) */
    entityProps?: EntityProperties;
    
    /** Tile data (if drawing a tile) */
    tileData?: any;
    
    /** Tile X coordinate (if drawing a tile) */
    tileX?: number;
    
    /** Tile Y coordinate (if drawing a tile) */
    tileY?: number;
}

/**
 * Helper to create a drawing context from function parameters
 */
export function createDrawingContext(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tileSize: number,
    time: number,
    assetImages: { [key: string]: HTMLImageElement },
    entity?: EntityState,
    entityProps?: EntityProperties,
    tileData?: any,
    tileX?: number,
    tileY?: number
): DrawingContext {
    return {
        ctx,
        x,
        y,
        tileSize,
        time,
        assetImages,
        entity,
        entityProps,
        tileData,
        tileX,
        tileY,
    };
}

