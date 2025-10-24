import { 
    EntityDamagedMessage,
    GearUpdateMessage,
    InitialStateMessage, 
    InventoryUpdateMessage, 
    EntityJoinedMessage,
    EntityLeftMessage,
    EntityMovedMessage,
    PlayerChatMessage,
    PlayerStatsUpdateMessage,
    RegisteredMessage,
    ResourceDamagedMessage, 
    ServerMessage, 
    StateCorrectionMessage, 
    WorldUpdateMessage,
    EntityAttackMessage
} from './types';
import * as state from './state';
import { addChatMessage, promptForRegistration, updateInventoryUI, updatePlayerHealth, updatePlayerNameDisplay } from './ui';
import { showDamageIndicator } from './renderer';

let ws: WebSocket;
const stateUpdateListeners: (() => void)[] = [];

export function addStateUpdateListener(callback: () => void) {
    stateUpdateListeners.push(callback);
}

function onStateUpdate() {
    stateUpdateListeners.forEach(cb => cb());
}

export function send(message: object) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}


function handleMessage(event: MessageEvent) {
    const msg: ServerMessage = JSON.parse(event.data);

    switch (msg.type) {
        case 'initial_state': {
            const stateMsg = msg as InitialStateMessage;
            // state.setInitialState now receives the full entity map
            state.setInitialState(stateMsg.playerId, stateMsg.entities, stateMsg.world, stateMsg.inventory, stateMsg.gear);
            updateInventoryUI();
            const myEntity = state.getMyEntity();
            if (myEntity && myEntity.name) {
                updatePlayerNameDisplay(myEntity.name);
            } else {
                // If we logged in but don't have a name, show the registration prompt.
                promptForRegistration();
            }
            onStateUpdate();
            break;
        }
        case 'state_correction': {
            const correctMsg = msg as StateCorrectionMessage;
            state.setEntityPosition(state.getState().playerId!, correctMsg.x, correctMsg.y);
            onStateUpdate();
            break;
        }
        case 'entity_moved': { 
            const moveMsg = msg as EntityMovedMessage;
            state.setEntityPosition(moveMsg.entityId, moveMsg.x, moveMsg.y, moveMsg.direction);
            onStateUpdate();
            break;
        }
        case 'entity_joined': {
            const joinMsg = msg as EntityJoinedMessage;
            state.addEntity({
                id: joinMsg.id,
                x: joinMsg.x,
                y: joinMsg.y,
                type: joinMsg.entityType,
                name: joinMsg.name,
                itemId: joinMsg.itemId,
                owner: joinMsg.owner,
                createdAt: joinMsg.createdAt,
                publicAt: joinMsg.publicAt,
            });
            onStateUpdate();
            break;
        }
        case 'entity_left': {
            const leftMsg = msg as EntityLeftMessage;
            state.removeEntity(leftMsg.entityId);
            onStateUpdate();
            break;
        }
        // (Other cases remain the same)
        case 'world_update': {
            const updateMsg = msg as WorldUpdateMessage;
            const key = `${updateMsg.x},${updateMsg.y}`;
            state.getState().world[key] = updateMsg.tile;
            onStateUpdate();
            break;
        }
        case 'inventory_update': {
            const invMsg = msg as InventoryUpdateMessage;
            state.setInventory(invMsg.inventory);
            updateInventoryUI();
            onStateUpdate();
            break;
        }
        case 'gear_update': {
            const gearMsg = msg as GearUpdateMessage;
            state.setGear(gearMsg.gear);
            // We need to update both UI sections as equipping/unequipping affects both.
            updateInventoryUI(); 
            onStateUpdate();
            break;
        }
        case 'resource_damaged': {
            const damageMsg = msg as ResourceDamagedMessage;
            state.setResourceHealth(damageMsg.x, damageMsg.y, damageMsg.newHealth);
            onStateUpdate();
            break;
        }
        case 'entity_attack': {
            const attackMsg = msg as EntityAttackMessage;
            state.setEntityAttack(attackMsg.attackerId, attackMsg.targetId);
            onStateUpdate();
            break;
        }
        case 'entity_damaged': {
            const damageMsg = msg as EntityDamagedMessage;
            showDamageIndicator(damageMsg.x, damageMsg.y, damageMsg.damage);
            onStateUpdate();
            break;
        }
        case 'player_stats_update': {
            const statsMsg = msg as PlayerStatsUpdateMessage;
            updatePlayerHealth(statsMsg.health, statsMsg.maxHealth);
            onStateUpdate();
            break;
        }
        case 'player_chat': {
            const chatMsg = msg as PlayerChatMessage;
            addChatMessage(chatMsg.playerId, chatMsg.message); // Update the chat box UI
            state.setEntityChat(chatMsg.playerId, chatMsg.message); // Update the entity's state for canvas rendering
            onStateUpdate();
            break;
        }
        case 'registered': {
            const regMsg = msg as RegisteredMessage;
            localStorage.setItem('secretKey', regMsg.secretKey);
            state.setPlayerId(regMsg.playerId); // Update our player ID
            updatePlayerNameDisplay(regMsg.name);
            onStateUpdate();
            break;
        }
    }
}

// (initializeNetwork remains the same)
export function initializeNetwork() {
    ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onmessage = handleMessage;

    ws.onopen = () => {
        console.log('Connected to the server.');
        document.getElementById('player-coords')!.textContent = 'Connected! Waiting for world state...';

        const secretKey = localStorage.getItem('secretKey');
        send({
            type: 'login',
            payload: {
                secretKey: secretKey,
            },
        });
    };

    ws.onclose = () => {
        console.log('Disconnected from the server.');
        document.getElementById('player-coords')!.textContent = 'Disconnected. Please refresh.';
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
}