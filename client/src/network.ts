import { 
    InitialStateMessage, 
    InventoryUpdateMessage, 
    PlayerJoinedMessage, 
    PlayerLeftMessage, 
    PlayerMovedMessage, 
    ResourceDamagedMessage, 
    ServerMessage, 
    StateCorrectionMessage, 
    WorldUpdateMessage 
} from './types';
import * as state from './state';
import { renderViewport, updateInventoryUI } from './ui';

const ws = new WebSocket(`ws://${window.location.host}/ws`);

/**
 * Sends a message object to the WebSocket server.
 * @param message The message object to send.
 */
export function send(message: object) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function handleMessage(event: MessageEvent) {
    const msg: ServerMessage = JSON.parse(event.data);

    switch (msg.type) {
        case 'initial_state': {
            const stateMsg = msg as InitialStateMessage;
            state.setInitialState(stateMsg.playerId, stateMsg.players, stateMsg.world, stateMsg.inventory);
            updateInventoryUI();
            break;
        }
        case 'state_correction': {
            const correctMsg = msg as StateCorrectionMessage;
            state.setPlayerPosition(state.getState().playerId!, correctMsg.x, correctMsg.y);
            break;
        }
        case 'resource_damaged': {
            const damageMsg = msg as ResourceDamagedMessage;
            state.setResourceHealth(damageMsg.x, damageMsg.y, damageMsg.newHealth);
            // We don't need to re-render here, the hit effect is enough visual feedback
            break;
        }
        case 'player_moved': {
            const moveMsg = msg as PlayerMovedMessage;
            state.setPlayerPosition(moveMsg.playerId, moveMsg.x, moveMsg.y);
            break;
        }
        case 'player_joined': {
            const joinMsg = msg as PlayerJoinedMessage;
            state.addPlayer(joinMsg.playerId, joinMsg.x, joinMsg.y);
            break;
        }
        case 'player_left': {
            const leftMsg = msg as PlayerLeftMessage;
            state.removePlayer(leftMsg.playerId);
            break;
        }
        case 'world_update': {
            const updateMsg = msg as WorldUpdateMessage;
            state.setWorldTile(updateMsg.x, updateMsg.y, updateMsg.tile);
            break;
        }
        case 'inventory_update': {
            const invMsg = msg as InventoryUpdateMessage;
            state.setInventoryItem(invMsg.resource, invMsg.amount);
            updateInventoryUI();
            break;
        }
    }
    // Re-render the game view after any state change.
    renderViewport();
}

export function initializeNetwork() {
    ws.onmessage = handleMessage;

    ws.onopen = () => {
        console.log('Connected to the server.');
        document.getElementById('player-coords')!.textContent = 'Connected! Waiting for world state...';
    };

    ws.onclose = () => {
        console.log('Disconnected from the server.');
        document.getElementById('player-coords')!.textContent = 'Disconnected. Please refresh.';
        // We should also remove input listeners here
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        document.getElementById('player-coords')!.textContent = 'Connection error.';
    };
}
