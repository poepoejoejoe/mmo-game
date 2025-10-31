/**
 * Drawing Registry System
 * 
 * Provides a centralized system for registering drawing functions for entities and tiles.
 * This makes it easier for LLMs to add new entities without manually updating imports.
 */

import { EntityState } from '../types';

/**
 * Drawing function signature for entities
 */
export type EntityDrawFunction = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tileSize: number,
    entity: EntityState,
    time: number,
    assetImages?: { [key: string]: HTMLImageElement },
    props?: any
) => void;

/**
 * Drawing function signature for tiles
 */
export type TileDrawFunction = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tileSize: number,
    worldX: number,
    worldY: number,
    time: number,
    tileData: any
) => void;

/**
 * Drawing function signature for items (weapons, etc.)
 */
export type ItemDrawFunction = (
    ctx: CanvasRenderingContext2D,
    pixelSize: number,
    direction: string
) => void;

/**
 * Registry for entity drawing functions
 */
const entityDrawRegistry = new Map<string, EntityDrawFunction>();

/**
 * Registry for tile drawing functions
 */
const tileDrawRegistry = new Map<string, TileDrawFunction>();

/**
 * Registry for item drawing functions
 */
const itemDrawRegistry = new Map<string, ItemDrawFunction>();

/**
 * Register an entity drawing function
 */
export function registerEntityDraw(entityType: string, drawFunction: EntityDrawFunction): void {
    entityDrawRegistry.set(entityType, drawFunction);
}

/**
 * Register a tile drawing function
 */
export function registerTileDraw(tileType: string, drawFunction: TileDrawFunction): void {
    tileDrawRegistry.set(tileType, drawFunction);
}

/**
 * Register an item drawing function
 */
export function registerItemDraw(itemType: string, drawFunction: ItemDrawFunction): void {
    itemDrawRegistry.set(itemType, drawFunction);
}

/**
 * Get an entity drawing function
 */
export function getEntityDraw(entityType: string): EntityDrawFunction | undefined {
    return entityDrawRegistry.get(entityType);
}

/**
 * Get a tile drawing function
 */
export function getTileDraw(tileType: string): TileDrawFunction | undefined {
    return tileDrawRegistry.get(tileType);
}

/**
 * Get an item drawing function
 */
export function getItemDraw(itemType: string): ItemDrawFunction | undefined {
    return itemDrawRegistry.get(itemType);
}

/**
 * Get all registered entity types
 */
export function getRegisteredEntityTypes(): string[] {
    return Array.from(entityDrawRegistry.keys());
}

/**
 * Get all registered tile types
 */
export function getRegisteredTileTypes(): string[] {
    return Array.from(tileDrawRegistry.keys());
}

/**
 * Get all registered item types
 */
export function getRegisteredItemTypes(): string[] {
    return Array.from(itemDrawRegistry.keys());
}

