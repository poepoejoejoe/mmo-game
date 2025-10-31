import { useEffect, useState, useRef, useCallback } from 'react';
import { initialize } from './main';
import * as state from './state';
import { toggleInfoPanel } from './ui';
import { DialogOption } from './types';
import { useGameState } from './hooks/useGameState';
import { registerWindowFunction } from './api/windowApi';
import PlayerCoords from './components/PlayerCoords';
import HealthBar from './components/HealthBar';
import ResonanceBar from './components/ResonanceBar';
import PlayerNameDisplay from './components/PlayerNameDisplay';
import EchoButton from './components/EchoButton';
import TeleportButton from './components/TeleportButton';
import ActionBar from './components/ActionBar';
import InventoryPanel from './components/InventoryPanel';
import CraftingPanel from './components/CraftingPanel';
import GearPanel from './components/GearPanel';
import QuestPanel from './components/QuestPanel';
import ExperiencePanel from './components/ExperiencePanel';
import RunesPanel from './components/RunesPanel';
import Dialog from './components/Dialog';
import Chat from './components/Chat';
import BankPanel from './components/BankPanel';
import Registration from './components/Registration';
import ChannelingBar from './components/ChannelingBar';
import HelpTooltip from './components/HelpModal';
import CraftSuccessAnimation from './components/CraftSuccessAnimation';
import ErrorMessages from './components/ErrorMessages';

function App() {
  const gameState = useGameState();
  const [openPanels, setOpenPanels] = useState(new Set<string>());
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    npcName?: string;
    text: string;
    options: DialogOption[];
    position: { x: number; y: number } | null;
  }>({
    isOpen: false,
    text: '',
    options: [],
    position: null,
  });
  const isInitialized = useRef(false);
  const inventoryStateBeforeBank = useRef<boolean | null>(null);

  const showDialog = useCallback((dialogMsg: { npcName?: string, text: string, options: DialogOption[] }, position: {x: number, y: number} | null) => {
    setDialog({
      isOpen: true,
      npcName: dialogMsg.npcName,
      text: dialogMsg.text,
      options: dialogMsg.options,
      position,
    });
  }, []);

  const hideDialog = useCallback(() => {
    setDialog(prev => ({ ...prev, isOpen: false }));
    state.setActiveNpcId(null);
  }, []);

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => !prev);
  }, []);

  const handleTogglePanel = useCallback((panelId: string) => {
    // This function now drives the state for both React and the legacy UI
    setOpenPanels(prevPanels => {
      const newPanels = new Set(prevPanels);
      const wasOpen = newPanels.has(panelId);
      
      // When opening the bank, remember the inventory state BEFORE modifying panels
      if (panelId === 'bank' && !wasOpen) {
        const inventoryWasOpen = prevPanels.has('inventory');
        inventoryStateBeforeBank.current = inventoryWasOpen;
      }
      
      if (wasOpen) {
        newPanels.delete(panelId);
      } else {
        newPanels.add(panelId);
      }
      
      // When opening the bank, open inventory if it was closed
      if (panelId === 'bank' && !wasOpen) {
        if (inventoryStateBeforeBank.current === false) {
          newPanels.add('inventory');
        }
      }
      
      // When closing the bank (manual close via toggle), restore inventory state
      if (panelId === 'bank' && wasOpen) {
        if (inventoryStateBeforeBank.current !== null) {
          if (inventoryStateBeforeBank.current === false) {
            // Inventory was closed, so close it now
            newPanels.delete('inventory');
          } else {
            // Inventory was open, make sure it stays open
            newPanels.add('inventory');
          }
          inventoryStateBeforeBank.current = null;
        }
      }
      
      return newPanels;
    });
    // Only call toggleInfoPanel for non-React panels
    if (panelId !== 'inventory' && panelId !== 'crafting' && panelId !== 'gear' && panelId !== 'quest' && panelId !== 'experience' && panelId !== 'runes' && panelId !== 'bank') {
      toggleInfoPanel(panelId as any);
    }
  }, []);

  const closeBankPanel = useCallback(() => {
    setOpenPanels(prevPanels => {
      if (!prevPanels.has('bank')) {
        return prevPanels;
      }
      
      const newPanels = new Set(prevPanels);
      newPanels.delete('bank');
      
      // Restore inventory state to what it was before opening the bank
      const savedState = inventoryStateBeforeBank.current;
      if (savedState !== null && savedState !== undefined) {
        if (savedState === false) {
          // Inventory was closed before bank opened, so close it now
          newPanels.delete('inventory');
        } else {
          // Inventory was open before bank opened, make sure it stays open
          newPanels.add('inventory');
        }
        inventoryStateBeforeBank.current = null;
      } else {
        // Fallback: if ref is null (edge case), close inventory if it's currently open
        // This handles cases where the ref might have been reset unexpectedly
        if (prevPanels.has('inventory')) {
          newPanels.delete('inventory');
        }
      }
      
      return newPanels;
    });
  }, []);

  const isBankOpen = useCallback(() => {
    return openPanels.has('bank');
  }, [openPanels]);

  useEffect(() => {
    // Register window API functions for legacy code compatibility
    const cleanupShowDialog = registerWindowFunction('showDialog', showDialog);
    const cleanupHideDialog = registerWindowFunction('hideDialog', hideDialog);
    const cleanupTogglePanel = registerWindowFunction('togglePanel', handleTogglePanel);
    const cleanupCloseBankPanel = registerWindowFunction('closeBankPanel', closeBankPanel);
    const cleanupIsBankOpen = registerWindowFunction('isBankOpen', isBankOpen);

    return () => {
      cleanupShowDialog();
      cleanupHideDialog();
      cleanupTogglePanel();
      cleanupCloseBankPanel();
      cleanupIsBankOpen();
    };
  }, [showDialog, hideDialog, handleTogglePanel, closeBankPanel, isBankOpen]);

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      // By wrapping initialize in a setTimeout, we push it to the end of the
      // event queue, ensuring that the DOM is fully rendered by React before
      // any of the legacy initialization code tries to access DOM elements.
      setTimeout(() => initialize(), 0);
    }
  }, []);

  return (
    <>
      <div className="game-container">
        {/* Top Info bar */}
        <div className="top-info">
            <img src="assets/game-title.png" id="game-title-logo" alt="Game Title" />
            <Registration playerName={gameState.playerName} />
            <button className="help-button" id="help-button">?</button>
        </div>

        {/* Game World */}
        <div className="main-content">
            <CraftSuccessAnimation />
            <ChannelingBar />
            <canvas id="game-canvas"></canvas>
        </div>
        
        <BankPanel
          isOpen={openPanels.has('bank')}
          onClose={() => handleTogglePanel('bank')}
          bank={gameState.bank}
        />
        
        {/* Bottom UI */}
        <div className="bottom-ui">
            <div className="left-hud-container">
                <button className="action-button" id="chat-button" onClick={toggleChat}>
                    <img src="assets/chat-icon.png" alt="Chat" />
                </button>
            </div>

            {isChatOpen && (
                <div id="chat-container" className="chat-container">
                    <Chat isOpen={isChatOpen} onToggle={toggleChat} />
                </div>
            )}

            <div id="player-hud-bottom">
                <PlayerNameDisplay name={gameState.playerName} />
                <HealthBar health={gameState.health.current} maxHealth={gameState.health.max} />
                {gameState.echo.unlocked && <ResonanceBar resonance={gameState.resonance.current} maxResonance={gameState.resonance.max} />}
                {gameState.echo.unlocked && <EchoButton isEcho={gameState.echo.isEcho} resonance={gameState.resonance.current} />}
                <TeleportButton />
                <PlayerCoords x={gameState.coords.x} y={gameState.coords.y} />
            </div>

            <div className="right-hud-container">
                <div className="info-panels">
                    <InventoryPanel 
                      isOpen={openPanels.has('inventory')} 
                      onClose={() => handleTogglePanel('inventory')}
                      inventory={gameState.inventory}
                      isBankOpen={openPanels.has('bank')}
                    />
                    <CraftingPanel
                      isOpen={openPanels.has('crafting')}
                      onClose={() => handleTogglePanel('crafting')}
                      inventory={gameState.inventory}
                      knownRecipes={gameState.knownRecipes}
                    />
                    <GearPanel
                      isOpen={openPanels.has('gear')}
                      onClose={() => handleTogglePanel('gear')}
                      gear={gameState.gear}
                    />
                    <QuestPanel
                      isOpen={openPanels.has('quest')}
                      onClose={() => handleTogglePanel('quest')}
                      quests={gameState.quests}
                    />
                    <ExperiencePanel
                      isOpen={openPanels.has('experience')}
                      onClose={() => handleTogglePanel('experience')}
                      experience={gameState.experience}
                    />
                    <RunesPanel
                      isOpen={openPanels.has('runes')}
                      onClose={() => handleTogglePanel('runes')}
                      runes={gameState.runes}
                      activeRune={gameState.activeRune}
                    />
                </div>
                <ActionBar openPanels={openPanels} onTogglePanel={handleTogglePanel} />
            </div>
        </div>
        
        {/* Mobile Joystick */}
        <div className="mobile-controls">
            <div className="joystick">
                <div className="joystick-handle"></div>
            </div>
        </div>
      </div>

      {/* Dialog Modal */}
      <Dialog
        isOpen={dialog.isOpen}
        npcName={dialog.npcName}
        text={dialog.text}
        options={dialog.options}
        position={dialog.position}
        onClose={hideDialog}
      />

      {/* Help Tooltip */}
      <HelpTooltip />

      {/* Error Messages */}
      <ErrorMessages />
    </>
  );
}

export default App;
