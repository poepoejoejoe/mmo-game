import { useState, useEffect } from 'react';
import * as state from '../state';
import { addStateUpdateListener } from '../network';
import { InventoryItem } from '../types';
import { Quest } from '../types';

export interface GameState {
  coords: { x: number; y: number };
  health: { current: number; max: number };
  resonance: { current: number; max: number };
  playerName: string;
  echo: { isEcho: boolean; unlocked: boolean };
  inventory: Record<string, InventoryItem>;
  knownRecipes: Record<string, boolean>;
  gear: Record<string, InventoryItem>;
  quests: Record<string, Quest>;
  experience: Record<string, number>;
  runes: string[];
  activeRune: string;
  bank: Record<string, InventoryItem>;
}

export function useGameState(): GameState {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [health, setHealth] = useState({ current: 0, max: 0 });
  const [resonance, setResonance] = useState({ current: 0, max: 1 });
  const [playerName, setPlayerName] = useState('');
  const [echo, setEcho] = useState({ isEcho: false, unlocked: false });
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [knownRecipes, setKnownRecipes] = useState<Record<string, boolean>>({});
  const [gear, setGear] = useState<Record<string, InventoryItem>>({});
  const [quests, setQuests] = useState<Record<string, Quest>>({});
  const [experience, setExperience] = useState<Record<string, number>>({});
  const [runes, setRunes] = useState<string[]>([]);
  const [activeRune, setActiveRune] = useState<string>('');
  const [bank, setBank] = useState<Record<string, InventoryItem>>({});

  useEffect(() => {
    // Initialize state from global state
    const me = state.getMyEntity();
    if (me) {
      setCoords({ x: me.x, y: me.y });
      setHealth({ current: me.health || 0, max: me.maxHealth || 0 });
      setPlayerName(me.name || '');
      const s = state.getState();
      setResonance({ current: s.resonance || 0, max: s.maxResonance || 1 });
      setEcho({ isEcho: me.isEcho || false, unlocked: s.echoUnlocked || false });
      setInventory(s.inventory ? { ...s.inventory } : {});
      setKnownRecipes(s.knownRecipes || {});
      setGear(s.gear || {});
      setQuests(s.quests || {});
      setExperience(s.experience || {});
      setRunes(s.runes || []);
      setActiveRune(s.activeRune || '');
      setBank(s.bank || {});
    }

    // Subscribe to state updates
    const unsubscribe = addStateUpdateListener(() => {
      const me = state.getMyEntity();
      const s = state.getState();
      
      // Update coords and health only if entity exists
      if (me) {
        setCoords(prevCoords => {
          if (prevCoords.x === me.x && prevCoords.y === me.y) {
            return prevCoords;
          }
          return { x: me.x, y: me.y };
        });
        setHealth(prevHealth => {
          const newHealth = { current: me.health || 0, max: me.maxHealth || 0 };
          if (prevHealth.current === newHealth.current && prevHealth.max === newHealth.max) {
            return prevHealth;
          }
          return newHealth;
        });
        setPlayerName(me.name || '');
        setEcho({ isEcho: me.isEcho || false, unlocked: s.echoUnlocked || false });
      }
      
      // Update inventory, gear, bank, etc. regardless of entity existence
      setResonance(prevResonance => {
        const newResonance = { current: s.resonance || 0, max: s.maxResonance || 1 };
        if (prevResonance.current === newResonance.current && prevResonance.max === newResonance.max) {
          return prevResonance;
        }
        return newResonance;
      });
      setInventory(prevInventory => {
        const newInventory = s.inventory ? { ...s.inventory } : {};
        // Check if inventory actually changed by comparing JSON strings
        const prevStr = JSON.stringify(prevInventory);
        const newStr = JSON.stringify(newInventory);
        if (prevStr === newStr) {
          return prevInventory;
        }
        return newInventory;
      });
      setKnownRecipes(s.knownRecipes || {});
      setGear(s.gear || {});
      setQuests(s.quests || {});
      setExperience(s.experience || {});
      setRunes(s.runes || []);
      setActiveRune(s.activeRune || '');
      setBank(s.bank || {});
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    coords,
    health,
    resonance,
    playerName,
    echo,
    inventory,
    knownRecipes,
    gear,
    quests,
    experience,
    runes,
    activeRune,
    bank,
  };
}

