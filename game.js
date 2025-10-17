document.addEventListener('DOMContentLoaded', () => {
    // --- Element Caching ---
    const gameContainer = document.getElementById('game-container');
    const playerCoordsEl = document.getElementById('player-coords');
    const playerIdEl = document.getElementById('player-id');
    const cooldownBar = document.getElementById('cooldown-bar');
    const cooldownText = document.getElementById('cooldown-text');
    const invWood = document.getElementById('inv-wood');
    const invRock = document.getElementById('inv-rock');

    // --- WebSocket Setup ---
    const ws = new WebSocket(`ws://${window.location.hostname}:8080/ws`);

    // --- Game Configuration ---
    const VIEWPORT_WIDTH = 31;
    const VIEWPORT_HEIGHT = 21;
    const TILE_SIZE = 20;

    // --- Client-Side State ---
    let clientState = {
        playerId: null,
        players: {},
        world: {}, // Will now store objects: { type, health }
        inventory: {}
    };

    // --- Cooldown Management ---
    let canPerformAction = true;
    const ACTION_COOLDOWN = 100; // ms, matches BaseActionCooldown on server
    const WATER_PENALTY = 500;   // ms, matches WaterMovePenalty on server

    // --- UI Update Functions ---

    /**
     * Starts the visual cooldown timer in the UI.
     * @param {number} duration The duration of the cooldown in milliseconds.
     */
    function startCooldown(duration) {
        canPerformAction = false;
        cooldownText.textContent = "Working...";
        cooldownBar.style.transform = "translateX(-100%)";
        cooldownBar.style.transition = "none";

        // Force a browser reflow to ensure the CSS animation restarts correctly.
        cooldownBar.offsetHeight;

        cooldownBar.style.transition = `transform ${duration}ms linear`;
        cooldownBar.style.transform = "translateX(0%)";

        setTimeout(() => {
            canPerformAction = true;
            cooldownText.textContent = "Ready";
        }, duration);
    }

    /**
     * Updates the inventory display with the latest counts from the client state.
     */
    function updateInventoryUI() {
        invWood.textContent = clientState.inventory.wood || 0;
        invRock.textContent = clientState.inventory.rock || 0;
    }

    // --- WebSocket Event Handlers ---

    ws.onopen = () => {
        console.log('Connected to the server.');
        playerCoordsEl.textContent = 'Connected! Waiting for world state...';
        document.addEventListener('keydown', handleKeyDown);
        gameContainer.addEventListener('click', handleMouseClick);
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        // Main message processing switch. Updates client state based on server messages.
        switch (msg.type) {
            case 'initial_state':
                clientState.playerId = msg.playerId;
                clientState.players = msg.players;
                clientState.world = msg.world;
                clientState.inventory = msg.inventory || {};
                updateInventoryUI();
                playerIdEl.textContent = `Your ID: ${msg.playerId}`;
                break;

            case 'state_correction':
                // The server is correcting our position. We must obey.
                console.log("Received state correction from server.");
                if (clientState.players[clientState.playerId]) {
                    clientState.players[clientState.playerId].x = msg.x;
                    clientState.players[clientState.playerId].y = msg.y;
                }
                break;

            case 'resource_damaged':
                const damagedKey = `${msg.x},${msg.y}`;
                if (clientState.world[damagedKey]) {
                    clientState.world[damagedKey].health = msg.newHealth;
                    // Trigger a temporary visual flash on the tile
                    showHitEffect(msg.x, msg.y);
                }
                break;

            case 'player_moved':
                if (clientState.players[msg.playerId]) {
                    clientState.players[msg.playerId].x = msg.x;
                    clientState.players[msg.playerId].y = msg.y;
                }
                break;

            case 'player_joined':
                clientState.players[msg.playerId] = { x: msg.x, y: msg.y };
                break;

            case 'player_left':
                delete clientState.players[msg.playerId];
                break;

            case 'world_update':
                // A tile's type has fundamentally changed (e.g., a tree was depleted).
                const worldUpdateKey = `${msg.x},${msg.y}`;
                if (clientState.world[worldUpdateKey]) {
                    clientState.world[worldUpdateKey].type = msg.tile;
                    clientState.world[worldUpdateKey].health = 0; // Depleted resources have 0 health.
                }
                break;

            case 'inventory_update':
                clientState.inventory[msg.resource] = msg.amount;
                updateInventoryUI();
                break;
        }

        // Re-render the game view after any state change.
        renderViewport();
    };

    ws.onclose = () => {
        console.log('Disconnected from the server.');
        playerCoordsEl.textContent = 'Disconnected. Please refresh.';
        document.removeEventListener('keydown', handleKeyDown);
        gameContainer.removeEventListener('click', handleMouseClick);
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        playerCoordsEl.textContent = 'Connection error.';
    };

    // --- Rendering Engine & Helpers ---

    function getTileData(x, y) {
        const key = `${x},${y}`;
        return clientState.world[key] || { type: 'void', health: 0 };
    }

    /**
     * Creates a temporary "flash" animation on a specific world tile.
     * @param {number} x The world x-coordinate of the tile.
     * @param {number} y The world y-coordinate of the tile.
     */
    function showHitEffect(x, y) {
        const me = clientState.players[clientState.playerId];
        if (!me) return;

        // Calculate the tile's position within the current viewport
        const halfWidth = Math.floor(VIEWPORT_WIDTH / 2);
        const halfHeight = Math.floor(VIEWPORT_HEIGHT / 2);
        const viewX = x - (me.x - halfWidth);
        const viewY = y - (me.y - halfHeight);

        // Check if the affected tile is actually visible on screen
        if (viewX >= 0 && viewX < VIEWPORT_WIDTH && viewY >= 0 && viewY < VIEWPORT_HEIGHT) {
            const cellIndex = viewY * VIEWPORT_WIDTH + viewX;
            const cell = gameContainer.children[cellIndex];
            if (cell) {
                const hitEffect = document.createElement('div');
                hitEffect.className = 'hit-effect';
                cell.appendChild(hitEffect);
                // Automatically remove the effect element after the animation finishes
                setTimeout(() => {
                    hitEffect.remove();
                }, 200);
            }
        }
    }

    function renderViewport() {
        const me = clientState.players[clientState.playerId];
        if (!me) { return; }

        gameContainer.innerHTML = '';
        gameContainer.style.gridTemplateColumns = `repeat(${VIEWPORT_WIDTH}, ${TILE_SIZE}px)`;
        gameContainer.style.gridTemplateRows = `repeat(${VIEWPORT_HEIGHT}, ${TILE_SIZE}px)`;

        const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
        const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);

        for (let j = 0; j < VIEWPORT_HEIGHT; j++) {
            for (let i = 0; i < VIEWPORT_WIDTH; i++) {
                const cell = document.createElement('div');
                const worldX = startX + i;
                const worldY = startY + j;

                let playerOnTile = null;
                for (const id in clientState.players) {
                    const p = clientState.players[id];
                    if (p.x === worldX && p.y === worldY) {
                        playerOnTile = id;
                        break;
                    }
                }

                const tileData = getTileData(worldX, worldY);
                let finalClass = 'grid-cell';
                finalClass += playerOnTile ? (playerOnTile === clientState.playerId ? ' player' : ' other-player') : ` ${tileData.type}`;
                cell.className = finalClass;

                // Add damage overlay for resources
                if (tileData.type === 'tree' || tileData.type === 'rock') {
                    const overlay = document.createElement('div');
                    overlay.className = 'damage-overlay';
                    const maxHealth = tileData.type === 'tree' ? 2 : 4;
                    const healthPercent = Math.max(0, tileData.health / maxHealth);
                    overlay.style.opacity = 1 - healthPercent;
                    cell.appendChild(overlay);
                }
                gameContainer.appendChild(cell);
            }
        }
        playerCoordsEl.textContent = `Your Position: (${me.x}, ${me.y})`;
    }

    // --- Input Handlers ---

    function handleKeyDown(e) {
        if (!canPerformAction || !clientState.playerId) return;

        let direction = null;
        switch (e.key.toLowerCase()) {
            case 'arrowup': case 'w': direction = 'up'; break;
            case 'arrowdown': case 's': direction = 'down'; break;
            case 'arrowleft': case 'a': direction = 'left'; break;
            case 'arrowright': case 'd': direction = 'right'; break;
            default: return;
        }

        const me = clientState.players[clientState.playerId];
        let targetX = me.x, targetY = me.y;

        switch (direction) {
            case 'up': targetY--; break;
            case 'down': targetY++; break;
            case 'left': targetX--; break;
            case 'right': targetX++; break;
        }

        // Client-side prediction for player collision
        for (const id in clientState.players) {
            if (clientState.players[id].x === targetX && clientState.players[id].y === targetY) {
                return;
            }
        }

        const targetTileData = getTileData(targetX, targetY);
        if (targetTileData.type === 'rock' || targetTileData.type === 'tree' || targetTileData.type === 'void') {
            return;
        }

        me.x = targetX;
        me.y = targetY;
        renderViewport();

        let cooldown = ACTION_COOLDOWN;
        if (targetTileData.type === 'water') {
            cooldown = WATER_PENALTY;
        }
        startCooldown(cooldown);

        ws.send(JSON.stringify({ type: 'move', payload: { direction: direction } }));
    }

    function handleMouseClick(e) {
        if (!canPerformAction || !clientState.playerId) return;

        const me = clientState.players[clientState.playerId];
        if (!me) return;

        const rect = gameContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const startX = me.x - Math.floor(VIEWPORT_WIDTH / 2);
        const startY = me.y - Math.floor(VIEWPORT_HEIGHT / 2);

        const tileX = Math.floor(clickX / TILE_SIZE) + startX;
        const tileY = Math.floor(clickY / TILE_SIZE) + startY;

        const distX = Math.abs(me.x - tileX);
        const distY = Math.abs(me.y - tileY);

        if ((distX + distY) !== 1) {
            return; // Not adjacent
        }

        const tileData = getTileData(tileX, tileY);
        if (tileData.type !== 'tree' && tileData.type !== 'rock') {
            return;
        }

        startCooldown(ACTION_COOLDOWN);
        ws.send(JSON.stringify({ type: 'interact', payload: { x: tileX, y: tileY } }));
    }
});