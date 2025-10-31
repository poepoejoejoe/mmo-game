import { 
    CraftSuccessMessage,
    EntityDamagedMessage,
    GearUpdateMessage,
    InitialStateMessage, 
    InventoryUpdateMessage, 
    EntityJoinedMessage,
    EntityLeftMessage,
    EntityMovedMessage,
    EntityUpdateMessage,
    PlayerAppearanceChangedMessage,
    PlayerChatMessage,
    PlayerStatsUpdateMessage,
    RegisteredMessage,
    ResourceDamagedMessage, 
    ServerMessage, 
    StateCorrectionMessage, 
    WorldUpdateMessage,
    EntityAttackMessage,
    DialogMessage,
    QuestUpdateMessage,
    NpcQuestStateUpdateMessage,
    ActiveRuneUpdateMessage,
    RecipeLearnedMessage,
    BankUpdateMessage
} from './types';
import * as state from './state';
import { 
    promptForRegistration, 
    showCraftSuccess, 
    updateInventoryUI, 
    showChannelingBar,
    hideChannelingBar,
    openBankWindow,
    updateBankUI
} from './ui';
import { showDamageIndicator } from './renderer';
import { setPath } from './input';

let ws: WebSocket;
const stateUpdateListeners: (() => void)[] = [];

export function addStateUpdateListener(callback: () => void) {
    stateUpdateListeners.push(callback);
    return () => {
        const index = stateUpdateListeners.indexOf(callback);
        if (index > -1) {
            stateUpdateListeners.splice(index, 1);
        }
    };
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
            const initialState = msg as InitialStateMessage;
            state.setInitialState(
                initialState.playerId,
                initialState.entities,
                initialState.world,
                initialState.inventory,
                initialState.gear,
                initialState.bank,
                initialState.quests,
                initialState.experience,
                initialState.resonance || 0,
                initialState.maxResonance || 1,
                initialState.echoUnlocked || false,
                initialState.runes || [],
                initialState.activeRune || '',
                initialState.knownRecipes || {},
            );
            updateInventoryUI();
            const myEntity = state.getMyEntity();
            if (myEntity && myEntity.name) {
                // This is now handled by React state
            } else {
                // If we logged in but don't have a name, show the registration prompt.
                promptForRegistration();
            }
            onStateUpdate();
            break;
        }
        case 'active_rune_update': {
            const runeMsg = msg as ActiveRuneUpdateMessage;
            state.setActiveRune(runeMsg.activeRune);
            updateInventoryUI(); // This will trigger a runes UI update
            onStateUpdate();
            break;
        }
        case 'quest_update': {
            const questMsg = msg as QuestUpdateMessage;
            state.setQuests(questMsg.quests);
            updateInventoryUI(); // This will trigger a quest UI update
            onStateUpdate();
            break;
        }
        case 'npc_quest_state_update': {
            const npcUpdateMsg = msg as NpcQuestStateUpdateMessage;
            state.updateNpcQuestState(npcUpdateMsg.npcName, npcUpdateMsg.questState);
            onStateUpdate();
            break;
        }
        case 'teleport_channel_start': {
            const channelMsg = msg as any; // Quick type assertion
            showChannelingBar(channelMsg.duration);
            break;
        }
        case 'teleport_channel_end': {
            hideChannelingBar();
            break;
        }
        case 'show_dialog': {
            const dialogMsg = msg as DialogMessage;
            const pos = state.getState().lastInteractionPosition;
            const showDialogFn = (window as any).showDialog;
            if (showDialogFn) {
                showDialogFn(dialogMsg, pos);
            }
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
                id: joinMsg.entityId,
                x: joinMsg.x,
                y: joinMsg.y,
                type: joinMsg.entityType,
                name: joinMsg.name,
                itemId: joinMsg.itemId,
                owner: joinMsg.owner,
                createdAt: joinMsg.createdAt,
                publicAt: joinMsg.publicAt,
                shirtColor: joinMsg.shirtColor,
                gear: joinMsg.gear,
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
        case 'entity_update': {
            const updateMsg = msg as EntityUpdateMessage;
            state.updateEntity(updateMsg);
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
            const inventoryMsg = msg as InventoryUpdateMessage;
            state.setInventory(inventoryMsg.inventory);
            updateInventoryUI();
            onStateUpdate();
            break;
        }
        case 'bank_update': {
            const bankMsg = msg as BankUpdateMessage;
            state.setBank(bankMsg.bank);
            updateBankUI();
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
        case 'craft_success': {
            const craftMsg = msg as CraftSuccessMessage;
            showCraftSuccess(craftMsg.itemId);
            break;
        }
        case 'player_appearance_changed': {
            const appearanceMsg = msg as PlayerAppearanceChangedMessage;
            state.setEntityGear(appearanceMsg.entityId, appearanceMsg.gear);
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
            const me = state.getMyEntity();

            if (me) {
                if (statsMsg.health !== undefined) me.health = statsMsg.health;
                if (statsMsg.maxHealth !== undefined) me.maxHealth = statsMsg.maxHealth;
            }

            if (statsMsg.experience) {
                state.setExperience(statsMsg.experience);
            }
            if (statsMsg.resonance !== undefined) {
                state.setResonance(statsMsg.resonance);
            }
            if (statsMsg.maxResonance !== undefined) {
                state.setMaxResonance(statsMsg.maxResonance);
            }
            if (statsMsg.echoUnlocked !== undefined) {
                state.setEchoUnlocked(statsMsg.echoUnlocked);
            }
            updateInventoryUI(); // This will trigger an experience UI update
            onStateUpdate();
            break;
        }
        case 'player_chat': {
            const chatMsg = msg as PlayerChatMessage;
            const addChatMessageFn = (window as any).addChatMessage;
            if (addChatMessageFn) {
                addChatMessageFn(chatMsg.playerId, chatMsg.message);
            }
            state.setEntityChat(chatMsg.playerId, chatMsg.message); // Update the entity's state for canvas rendering
            onStateUpdate();
            break;
        }
        case 'recipe_learned': {
            const recipeMsg = msg as RecipeLearnedMessage;
            state.learnRecipe(recipeMsg.recipeId);
            updateInventoryUI(); // This will trigger a crafting UI update
            onStateUpdate();
            break;
        }
        case 'registered': {
            const regMsg = msg as RegisteredMessage;
            localStorage.setItem('secretKey', regMsg.secretKey);
            state.setPlayerId(regMsg.playerId); // Update our player ID
            // This is now handled by React state
            onStateUpdate();
            break;
        }
        case 'no-valid-path':
            console.log("No valid path found.");
            break;
        case 'valid-path':
            setPath(msg.payload.directions);
            break;
        case 'open_bank_window':
            openBankWindow();
            break;
        case 'dead':
            // handlePlayerDeath(msg.payload.message); // This function is not defined in the original file
            break;
    }
}

// (initializeNetwork remains the same)
export function initializeNetwork() {
    ws = new WebSocket(`ws://localhost:8080/ws`);
    ws.onmessage = handleMessage;

    ws.onopen = () => {
        console.log('Connection opened!');
        console.log('Connected to the server.');
        // This is now handled by React components.
        // document.getElementById('player-coords')!.textContent = 'Connected! Waiting for world state...';

        const secretKey = localStorage.getItem('secretKey');
        send({
            type: 'login',
            payload: {
                secretKey: secretKey,
            },
        });
    };

    ws.onclose = (event) => {
        console.log('Connection closed.', event);
        console.log('Disconnected from the server.');
        document.getElementById('player-coords')!.textContent = 'Disconnected. Please refresh.';
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
}

export function sendLearnRecipe(inventorySlot: string) {
    send({
        type: 'learn_recipe',
        payload: {
            inventorySlot,
        },
    });
}

export function sendDepositItem(slot: string, quantity: number) {
    send({
        type: 'deposit_item',
        payload: {
            slot,
            quantity,
        },
    });
}

export function sendWithdrawItem(slot: string, quantity: number) {
    send({
        type: 'withdraw_item',
        payload: {
            slot,
            quantity,
        },
    });
}