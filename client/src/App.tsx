import React, { useEffect, useState, useRef } from 'react';
import { initialize } from './main';
import * as state from './state';
import { addStateUpdateListener } from './network';
import PlayerCoords from './components/PlayerCoords';

function App() {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const isInitialized = useRef(false);

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
            {/* Registration will be shown here if needed */}
            <div id="welcome-message"></div>
            <button className="help-button" id="help-button">?</button>
        </div>

        {/* Game World */}
        <div className="main-content">
            <div id="effect-container"></div>
            <div id="channeling-container">
                <div id="channeling-bar"></div>
            </div>
            <canvas id="game-canvas"></canvas>
        </div>
        
        <div id="bank-view" className="info-panel centered-panel" style={{display: 'none'}}></div>

        {/* Bottom UI */}
        <div className="bottom-ui">
            <div className="left-hud-container">
                <button className="action-button" id="chat-button">💬</button>
            </div>

            <div id="chat-container">
                <div id="chat-messages"></div>
                <input type="text" id="chat-input" placeholder="Say something..." />
                <div id="registration-container" style={{display: 'none', marginTop: '10px'}}>
                    <input type="text" id="name-input" placeholder="Enter name to save progress" maxLength={15} />
                    <button id="register-button">Save</button>
                </div>
            </div>

            <div id="player-hud-bottom">
                <div id="player-name-display"></div>
                <div className="hp-display">
                    <img src="assets/heart-icon.png" alt="Health" className="hud-icon" />
                    <div id="health-bar-container">
                        <div id="health-bar"></div>
                        <span id="health-bar-text"></span>
                    </div>
                </div>
                <div className="resonance-display">
                    <img src="assets/resonance-icon.png" alt="Resonance" className="hud-icon" />
                    <div id="resonance-bar-container">
                        <div id="resonance-bar"></div>
                        <span id="resonance-bar-text"></span>
                    </div>
                </div>
                <button id="echo-button" className="action-button" title="Activate Echo"></button>
                <button id="teleport-button" className="action-button" title="Teleport to Sanctuary Stone"></button>
                <PlayerCoords x={coords.x} y={coords.y} />
            </div>

            <div className="right-hud-container">
                <div className="info-panels">
                    <div id="inventory-view" className="info-panel" style={{display: 'none'}}></div>
                    <div id="crafting-view" className="info-panel" style={{display: 'none'}}></div>
                    <div id="gear-view" className="info-panel" style={{display: 'none'}}></div>
                    <div id="quest-view" className="info-panel" style={{display: 'none'}}></div>
                    <div id="experience-view" className="info-panel" style={{display: 'none'}}></div>
                    <div id="runes-view" className="info-panel" style={{display: 'none'}}></div>
                </div>
                <div id="main-action-bar" className="action-bar">
                    <button className="action-button" id="inventory-button">🎒</button>
                    <button className="action-button" id="crafting-button">🔨</button>
                    <button className="action-button" id="gear-button">🛡️</button>
                    <button className="action-button" id="quest-button"></button>
                    <button className="action-button" id="experience-button">⭐</button>
                    <button className="action-button" id="runes-button"></button>
                </div>
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
      <div id="dialog-overlay"></div>
      <div id="dialog-modal" className="dialog-popup">
          <div className="modal-header">
              <h2 id="dialog-npc-name">NPC Name</h2>
              <span className="close-button" id="dialog-close-button">&times;</span>
          </div>
          <div id="dialog-text">
              <p>Hello there, traveler!</p>
          </div>
          <div id="dialog-options">
              {/* Options will be added dynamically */}
          </div>
      </div>

      {/* Help Modal */}
      <div id="help-modal" className="modal">
          <div className="modal-content">
              <div className="modal-header">
                  <h2>Controls</h2>
                  <span className="close-button" id="help-modal-close">&times;</span>
              </div>
              <p><b>Arrow Keys / WASD:</b>Move 1 tile</p>
              <p><b>Right Click:</b>Click to move (if valid path exists)</p>
              <p><b>Left-Click (and hold) Adjacent Resource:</b> Gather</p>
              <p><b>B:</b> Build Wall mode (left click to place wall)</p>
              <p><b>F:</b> Build Fire mode (left click to place fire)</p>
          </div>
      </div>

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
