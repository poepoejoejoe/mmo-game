import { useState } from 'react';

interface UseTooltipOptions {
  offsetY?: number;
  offsetX?: number;
}

interface UseTooltipReturn<T> {
  hoveredKey: T | null;
  tooltipPosition: { x: number; y: number } | null;
  handleMouseEnter: (e: React.MouseEvent<HTMLElement>, key: T) => void;
  handleMouseLeave: () => void;
  clearTooltip: () => void;
}

/**
 * Hook for managing tooltip state and position
 * 
 * @template T - The type of key used to identify hovered items (e.g., string for slot keys)
 * @param options - Configuration options for tooltip positioning
 * @returns Object containing hovered key, position, and event handlers
 * 
 * @example
 * ```tsx
 * const { hoveredSlot, tooltipPosition, handleMouseEnter, handleMouseLeave } = useTooltip<string>();
 * 
 * <div onMouseEnter={(e) => handleMouseEnter(e, 'slot_0')} onMouseLeave={handleMouseLeave}>
 *   ...
 * </div>
 * ```
 */
export function useTooltip<T = string>(
  options: UseTooltipOptions = {}
): UseTooltipReturn<T> {
  const { offsetY = 5, offsetX = 0 } = options;
  const [hoveredKey, setHoveredKey] = useState<T | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, key: T) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredKey(key);
    setTooltipPosition({
      x: rect.left + offsetX,
      y: rect.bottom + offsetY,
    });
  };

  const handleMouseLeave = () => {
    setHoveredKey(null);
    setTooltipPosition(null);
  };

  const clearTooltip = () => {
    setHoveredKey(null);
    setTooltipPosition(null);
  };

  return {
    hoveredKey,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
    clearTooltip,
  };
}

