import { 
    InitialStateMessage, 
    InventoryUpdateMessage, 
    PlayerJoinedMessage, 
    PlayerLeftMessage, 
    EntityMovedMessage, // <-- RENAMED
    ResourceDamagedMessage, 
    ServerMessage, 
    StateCorrectionMessage, 
    WorldUpdateMessage 
} from './types';
import * as state from './state';
import { updateInventoryUI, updatePlayerIdDisplay } from './ui';

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
            // Use new entities field
            state.setInitialState(stateMsg.playerId, stateMsg.entities, stateMsg.world, stateMsg.inventory); // <-- UPDATED
            updateInventoryUI();
            updatePlayerIdDisplay(); // Update the player ID display
            break;
        }
        case 'state_correction': {
            const correctMsg = msg as StateCorrectionMessage;
            // Use new generic function
            state.setEntityPosition(state.getState().playerId!, correctMsg.x, correctMsg.y); // <-- UPDATED
            break;
        }
        // --- RENAMED and UPDATED ---
        case 'entity_moved': { 
            const moveMsg = msg as EntityMovedMessage;
            // Use new entityId field and new generic function
            state.setEntityPosition(moveMsg.entityId, moveMsg.x, moveMsg.y); // <-- UPDATED
            break;
        }
        case 'player_joined': {
            const joinMsg = msg as PlayerJoinedMessage;
            // Use new generic function
            state.addEntity(joinMsg.playerId, joinMsg.x, joinMsg.y); // <-- UPDATED
            break;
        }
        case 'player_left': {
            const leftMsg = msg as PlayerLeftMessage;
            // Use new generic function
            state.removeEntity(leftMsg.playerId); // <-- UPDATED
            break;
        }
        case 'world_update': {
            const updateMsg = msg as WorldUpdateMessage;
            const key = `${updateMsg.x},${updateMsg.y}`;
            state.getState().world[key] = updateMsg.tile;
            break;
        }
        case 'inventory_update': {
            const invMsg = msg as InventoryUpdateMessage;
            state.setInventoryItem(invMsg.resource, invMsg.amount);
            updateInventoryUI();
            break;
        }
        case 'resource_damaged': {
            const damageMsg = msg as ResourceDamagedMessage;
            state.setResourceHealth(damageMsg.x, damageMsg.y, damageMsg.newHealth);
            break;
        }
    }
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
    };
}
