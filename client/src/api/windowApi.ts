/**
 * Centralized Window API for React-React bridge
 * 
 * This file provides type-safe access to functions exposed on the window object
 * for legacy code compatibility. Instead of using (window as any), components
 * should use these typed functions.
 */

import { DialogOption } from '../types';

/**
 * Type definition for all functions exposed on the window object
 */
export interface WindowAPI {
  showDialog?: (dialogMsg: { npcName?: string; text: string; options: DialogOption[] }, position: { x: number; y: number } | null) => void;
  hideDialog?: () => void;
  togglePanel?: (panelId: string) => void;
  closeBankPanel?: () => void;
  isBankOpen?: () => boolean;
  addChatMessage?: (playerId: string, message: string) => void;
  showChannelingBar?: (durationMs: number) => void;
  hideChannelingBar?: () => void;
  promptForRegistration?: () => void;
  showCraftSuccess?: (itemId: string) => void;
}

/**
 * Get the window API with proper typing
 */
export function getWindowAPI(): WindowAPI {
  return (window as unknown as WindowAPI);
}

/**
 * Register a function on the window API
 */
export function registerWindowFunction<K extends keyof WindowAPI>(
  key: K,
  fn: NonNullable<WindowAPI[K]>
): () => void {
  getWindowAPI()[key] = fn;
  
  // Return cleanup function
  return () => {
    delete getWindowAPI()[key];
  };
}

/**
 * Call a window API function safely
 */
export function callWindowFunction<K extends keyof WindowAPI>(
  key: K,
  ...args: any[]
): void {
  const fn = getWindowAPI()[key];
  if (fn) {
    (fn as any)(...args);
  }
}

