import { 
    EntityDamagedMessage,
    InitialStateMessage, 
    InventoryUpdateMessage, 
    EntityJoinedMessage,
    EntityLeftMessage,
    EntityMovedMessage,
    ResourceDamagedMessage, 
    ServerMessage, 
    StateCorrectionMessage, 
    WorldUpdateMessage 
} from './types';
import * as state from './state';
import { updateInventoryUI, updatePlayerIdDisplay } from './ui';
import { showDamageIndicator } from './renderer';

// (ws and send function remain the same)
const ws = new WebSocket(`ws://${window.location.host}/ws`);

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
            // state.setInitialState now receives the full entity map
            state.setInitialState(stateMsg.playerId, stateMsg.entities, stateMsg.world, stateMsg.inventory);
            updateInventoryUI();
            updatePlayerIdDisplay();
            break;
        }
        case 'state_correction': {
            const correctMsg = msg as StateCorrectionMessage;
            state.setEntityPosition(state.getState().playerId!, correctMsg.x, correctMsg.y);
            break;
        }
        case 'entity_moved': { 
            const moveMsg = msg as EntityMovedMessage;
            state.setEntityPosition(moveMsg.entityId, moveMsg.x, moveMsg.y);
            break;
        }
        case 'entity_joined': {
            const joinMsg = msg as EntityJoinedMessage;
            // --- UPDATED ---
            // Pass the new 'type' field to our state function
            state.addEntity(joinMsg.entityId, joinMsg.x, joinMsg.y, joinMsg.entityType);
            break;
        }
        case 'entity_left': {
            const leftMsg = msg as EntityLeftMessage;
            state.removeEntity(leftMsg.entityId);
            break;
        }
        // (Other cases remain the same)
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
        case 'entity_damaged': {
            const damageMsg = msg as EntityDamagedMessage;
            const targetEntity = state.getState().entities[damageMsg.entityId];
            if (targetEntity) {
                showDamageIndicator(targetEntity.x, targetEntity.y, damageMsg.damage);
            }
            break;
        }
    }
}

// (initializeNetwork remains the same)
export function initializeNetwork() {
    ws.onmessage = handleMessage;

    ws.onopen = () => {
        console.log('Connected to the server.');
        document.getElementById('player-coords')!.textContent = 'Connected! Waiting for world state...';
    };

    ws.onclose = () => {
        console.log('Disconnected from the server.');
        document.getElementById('player-coords')!.textContent = 'Disconnected. Please refresh.';
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
}