/**
 * Drawing Constants
 * 
 * Centralized constants for drawing operations to make it easier for LLMs to:
 * - Understand what values are used for styling
 * - Modify visual appearance without hunting through code
 * - Add new entities with consistent styling
 */

// === Colors ===
export const COLORS = {
  // Shadow colors
  SHADOW_BLACK: 'rgba(0, 0, 0, 0.15)',
  SHADOW_BLACK_DARK: 'rgba(0, 0, 0, 0.3)',
  SHADOW_BLACK_DARKER: 'rgba(0, 0, 0, 0.4)',
  
  // Player colors
  HAIR_DEFAULT: '#634b3a',
  HAIR_HELMET: '#bdc3c7',
  SKIN: '#d3a07c',
  SHIRT_DEFAULT: '#7b9c48',
  SHIRT_WIZARD: '#3498db',
  PANTS: '#6d533b',
  PANTS_WIZARD: '#2c3e50',
  
  // Quest indicator colors
  QUEST_AVAILABLE: '#f1c40f',
  QUEST_IN_PROGRESS: '#bdc3c7',
  QUEST_TURN_IN_READY: '#f1c40f',
  
  // Weapon colors
  HANDLE: '#8B4513',
  WOOD_GRAIN: '#A0522D',
  STONE: '#808080',
  STONE_HIGHLIGHT: '#A9A9A9',
  STRAP: '#6d533b',
  
  // Tile colors
  WATER_SHORE: 'rgba(88, 178, 233, 0.7)',
  SANCTUARY_CYAN: '#00FFFF',
  
  // Golem banker colors
  GOLEM_BODY: '#808080',
  GOLEM_RUNE: 'rgba(0, 255, 255,', // Cyan for rune (trailing comma for opacity)
  GOLEM_VAULT_DOOR: '#6d533b',
  GOLEM_VAULT_DETAIL: '#4a3a2a',
  
  // Text colors
  TEXT_WHITE: '#ffffff',
  TEXT_BLACK: '#000000',
} as const;

// === Animation Constants ===
export const ANIMATION = {
  // Quest indicator
  QUEST_PULSE_SPEED: 200,
  QUEST_PULSE_MIN: 0.95,
  QUEST_PULSE_MAX: 1.0,
  QUEST_BOUNCE_SPEED: 200,
  QUEST_BOUNCE_AMOUNT: 0.05,
  
  // Walk cycle
  WALK_CYCLE_SPEED: 200,
  MOVEMENT_THRESHOLD: 200, // ms
  
  // Rat animation
  RAT_JIGGLE_SPEED: 80,
  RAT_JIGGLE_AMOUNT: 0.5,
  
  // Slime animation
  SLIME_WOBBLE_SPEED: 150,
  SLIME_WOBBLE_AMOUNT: 1.5,
  SLIME_STRETCH_SPEED: 150,
  SLIME_STRETCH_AMOUNT: 1.5,
  
  // Golem banker animation
  GOLEM_RUNE_PULSE_SPEED: 500,
  
  // Sanctuary
  SANCTUARY_FLOAT_FREQUENCY: 3000,
  SANCTUARY_FLOAT_AMPLITUDE: 0.5,
  
  // Damage indicators
  DAMAGE_INDICATOR_LIFETIME: 1000,
} as const;

// === Size Multipliers ===
export const SIZE = {
  // Quest indicator
  QUEST_HEIGHT_MULTIPLIER: 0.7,
  QUEST_Y_OFFSET: 0.4,
  
  // Shadow
  SHADOW_WIDTH_MULTIPLIER: 6,
  SHADOW_HEIGHT_MULTIPLIER: 2.5,
  SHADOW_Y_OFFSET: 2,
  
  // Item
  ITEM_SIZE_MULTIPLIER: 1.0,
  ITEM_FONT_MULTIPLIER: 0.8,
  
  // Weapon
  WEAPON_SIZE_MULTIPLIER: 0.75,
  
  // Pixel size calculation
  PIXEL_SIZE_DIVISOR: 16,
  
  // Sanctuary
  SANCTUARY_OBELISK_WIDTH: 0.4,
  SANCTUARY_OBELISK_HEIGHT: 0.8,
  
  // Tree
  TREE_CANOPY_BASE: 0.4,
  TREE_CANOPY_VARIATION: 0.1,
  
  // Golem banker sizes
  GOLEM_BODY_WIDTH: 10,
  GOLEM_BODY_HEIGHT: 12,
  GOLEM_RUNE_FONT_SIZE: 6,
  GOLEM_VAULT_DOOR_WIDTH: 4,
  GOLEM_VAULT_DOOR_HEIGHT: 4,
  GOLEM_VAULT_DETAIL_WIDTH: 2,
  GOLEM_VAULT_DETAIL_HEIGHT: 2,
} as const;

// === Drawing Ratios ===
export const RATIOS = {
  // Health display
  HEALTH_BAR_MAX_ROCKS: 8,
  HEALTH_BAR_CRACKS_PER_DAMAGE: 4,
  HEALTH_BAR_CRACKS_MAX: 8,
  
  // Lighten color
  COLOR_LIGHTEN_DEFAULT: 20,
  COLOR_LIGHTEN_ECHO: 50,
} as const;

// === Opacity Values ===
export const OPACITY = {
  SHADOW_LIGHT: 0.15,
  SHADOW_MEDIUM: 0.3,
  SHADOW_DARK: 0.4,
  SANCTUARY_ENTITY: 0.8,
  ECHO: 0.5,
  TEXT_FADE_MIN: 0.5,
  TEXT_FADE_MAX: 1.0,
} as const;

// === Text Constants ===
export const TEXT = {
  QUEST_AVAILABLE_CHAR: '!',
  QUEST_TURN_IN_CHAR: '?',
  FONT_FAMILY_DEFAULT: "'Arial', sans-serif",
  FONT_FAMILY_PIXEL: '"Press Start 2P"',
} as const;

// === Chat Message Constants ===
export const CHAT = {
  DURATION: 5000,
  FONT_SIZE: 12,
  FONT_FAMILY: "'Inter', sans-serif",
  MAX_WIDTH: 150,
  LINE_HEIGHT: 14,
  Y_OFFSET: 10,
} as const;

