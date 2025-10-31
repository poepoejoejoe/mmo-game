import { useEffect, useState, useRef, useCallback } from 'react';
import { initialize } from './main';
import * as state from './state';
import { addStateUpdateListener } from './network';
import { toggleInfoPanel } from './ui';
import { InventoryItem } from './types';
import { Quest } from './types';
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
import { DialogOption } from './types';

function App() {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [health, setHealth] = useState({ current: 0, max: 0 });
  const [resonance, setResonance] = useState({ current: 0, max: 1 });
  const [playerName, setPlayerName] = useState('');
  const [echo, setEcho] = useState({ isEcho: false, unlocked: false });
  const [openPanels, setOpenPanels] = useState(new Set<string>());
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [knownRecipes, setKnownRecipes] = useState<Record<string, boolean>>({});
  const [gear, setGear] = useState<Record<string, InventoryItem>>({});
  const [quests, setQuests] = useState<Record<string, Quest>>({});
  const [experience, setExperience] = useState<Record<string, number>>({});
  const [runes, setRunes] = useState<string[]>([]);
  const [activeRune, setActiveRune] = useState<string>('');
  const [bank, setBank] = useState<Record<string, InventoryItem>>({});
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
      if (newPanels.has(panelId)) {
        newPanels.delete(panelId);
      } else {
        newPanels.add(panelId);
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
      if (prevPanels.has('bank')) {
        const newPanels = new Set(prevPanels);
        newPanels.delete('bank');
        return newPanels;
      }
      return prevPanels;
    });
  }, []);

  useEffect(() => {
    // Expose showDialog and hideDialog functions for network.ts to use
    (window as any).showDialog = showDialog;
    (window as any).hideDialog = hideDialog;
    // Expose togglePanel for bank button to use
    (window as any).togglePanel = handleTogglePanel;
    // Expose closeBankPanel for closing bank when walking away
    (window as any).closeBankPanel = closeBankPanel;
  }, [showDialog, hideDialog, handleTogglePanel, closeBankPanel]);

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      // By wrapping initialize in a setTimeout, we push it to the end of the
      // event queue, ensuring that the DOM is fully rendered by React before
      // any of the legacy initialization code tries to access DOM elements.
      setTimeout(() => initialize(), 0);
    }

    const me = state.getMyEntity();
    if (me) {
      setCoords({ x: me.x, y: me.y });
      setHealth({ current: me.health || 0, max: me.maxHealth || 0 });
      setPlayerName(me.name || '');
      const s = state.getState();
      setResonance({ current: s.resonance || 0, max: s.maxResonance || 1 });
      setEcho({ isEcho: me.isEcho || false, unlocked: s.echoUnlocked || false });
      setInventory(s.inventory);
      setKnownRecipes(s.knownRecipes || {});
      setGear(s.gear || {});
      setQuests(s.quests || {});
      setExperience(s.experience || {});
      setRunes(s.runes || []);
      setActiveRune(s.activeRune || '');
      setBank(s.bank || {});
    }

    const unsubscribe = addStateUpdateListener(() => {
      const me = state.getMyEntity();
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
        const s = state.getState();
        setResonance(prevResonance => {
          const newResonance = { current: s.resonance || 0, max: s.maxResonance || 1 };
          if (prevResonance.current === newResonance.current && prevResonance.max === newResonance.max) {
            return prevResonance;
          }
          return newResonance;
        });
        setEcho({ isEcho: me.isEcho || false, unlocked: s.echoUnlocked || false });
        setInventory(s.inventory);
        setKnownRecipes(s.knownRecipes || {});
        setGear(s.gear || {});
        setQuests(s.quests || {});
        setExperience(s.experience || {});
        setRunes(s.runes || []);
        setActiveRune(s.activeRune || '');
        setBank(s.bank || {});
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      <div className="game-container">
        {/* Top Info bar */}
        <div className="top-info">
            <img src="assets/game-title.png" id="game-title-logo" alt="Game Title" />
            <Registration playerName={playerName} />
            <button className="help-button" id="help-button">?</button>
        </div>

        {/* Game World */}
        <div className="main-content">
            <CraftSuccessAnimation />
            <ChannelingBar />
            <canvas id="game-canvas"></canvas>
        </div>
        
        {/* Bank Panel - rendered inside game-container for proper centering */}
        <BankPanel
          isOpen={openPanels.has('bank')}
          onClose={() => handleTogglePanel('bank')}
          bank={bank}
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
                <PlayerNameDisplay name={playerName} />
                <HealthBar health={health.current} maxHealth={health.max} />
                {echo.unlocked && <ResonanceBar resonance={resonance.current} maxResonance={resonance.max} />}
                {echo.unlocked && <EchoButton isEcho={echo.isEcho} resonance={resonance.current} />}
                <TeleportButton />
                <PlayerCoords x={coords.x} y={coords.y} />
            </div>

            <div className="right-hud-container">
                <div className="info-panels">
                    <InventoryPanel 
                      isOpen={openPanels.has('inventory')} 
                      onClose={() => handleTogglePanel('inventory')}
                      inventory={inventory}
                      isBankOpen={openPanels.has('bank')}
                    />
                    <CraftingPanel
                      isOpen={openPanels.has('crafting')}
                      onClose={() => handleTogglePanel('crafting')}
                      inventory={inventory}
                      knownRecipes={knownRecipes}
                    />
                    <GearPanel
                      isOpen={openPanels.has('gear')}
                      onClose={() => handleTogglePanel('gear')}
                      gear={gear}
                    />
                    <QuestPanel
                      isOpen={openPanels.has('quest')}
                      onClose={() => handleTogglePanel('quest')}
                      quests={quests}
                    />
                    <ExperiencePanel
                      isOpen={openPanels.has('experience')}
                      onClose={() => handleTogglePanel('experience')}
                      experience={experience}
                    />
                    <RunesPanel
                      isOpen={openPanels.has('runes')}
                      onClose={() => handleTogglePanel('runes')}
                      runes={runes}
                      activeRune={activeRune}
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

      <div id="bank-context-menu" className="context-menu" style={{display: 'none'}}></div>
      <div id="quantity-modal" className="modal">
          <div className="modal-content">
              <h3>How many?</h3>
              <input type="number" id="quantity-input" min="1" />
              <button id="quantity-submit">OK</button>
          </div>
      </div>
    </>
  );
}

export default App;
