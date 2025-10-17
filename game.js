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
        world: {},
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

        // Force a browser reflow. This is a trick to ensure the CSS animation restarts correctly.
        cooldownBar.offsetHeight;

        cooldownBar.style.transition = `transform ${duration}ms linear`;
        cooldownBar.style.transform = "translateX(0%)";

        setTimeout(() => {
            canPerformAction = true;
            cooldownText.textContent = "Ready";
        }, duration);
    }

    /**
     * Updates the inventory display with the latest counts.
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
                // A tile in the world has changed (e.g., a tree was chopped down).
                const key = `${msg.x},${msg.y}`;
                clientState.world[key] = msg.tile;
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

    // --- Rendering Engine ---

    function getTileTypeFromState(x, y) {
        const key = `${x},${y}`;
        return clientState.world[key] || 'void'; // Default to 'void' if not in map
    }

    function renderViewport() {
        const me = clientState.players[clientState.playerId];
        if (!me) { return; }

        gameContainer.innerHTML = '';
        gameContainer.style.gridTemplateColumns = `repeat(${VIEWPORT_WIDTH}, ${TILE_SIZE}px)`;
        gameContainer.style.gridTemplateRows = `repeat(${VIEWPORT_HEIGHT}, ${TILE_SIZE}px)`;

        const halfWidth = Math.floor(VIEWPORT_WIDTH / 2);
        const halfHeight = Math.floor(VIEWPORT_HEIGHT / 2);
        const startX = me.x - halfWidth;
        const startY = me.y - halfHeight;

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

                let finalClass = 'grid-cell';
                if (playerOnTile) {
                    finalClass += playerOnTile === clientState.playerId ? ' player' : ' other-player';
                } else {
                    finalClass += ` ${getTileTypeFromState(worldX, worldY)}`;
                }

                cell.className = finalClass;
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
        let targetX = me.x;
        let targetY = me.y;

        switch (direction) {
            case 'up': targetY--; break;
            case 'down': targetY++; break;
            case 'left': targetX--; break;
            case 'right': targetX++; break;
        }

        // Client-side prediction for player collision
        for (const id in clientState.players) {
            if (clientState.players[id].x === targetX && clientState.players[id].y === targetY) {
                return; // Tile is blocked by another player
            }
        }

        // Client-side prediction for terrain collision
        const targetTileType = getTileTypeFromState(targetX, targetY);
        if (targetTileType === 'rock' || targetTileType === 'tree' || targetTileType === 'void') {
            return;
        }

        // Optimistically move the player on the client for a responsive feel
        me.x = targetX;
        me.y = targetY;
        renderViewport();

        let cooldown = ACTION_COOLDOWN;
        if (targetTileType === 'water') {
            cooldown = WATER_PENALTY;
        }
        startCooldown(cooldown);

        // Send the move request to the server for validation
        const msg = {
            type: 'move',
            payload: { direction: direction }
        };
        ws.send(JSON.stringify(msg));
    }

    function handleMouseClick(e) {
        if (!canPerformAction || !clientState.playerId) return;

        const me = clientState.players[clientState.playerId];
        if (!me) return;

        // 1. Calculate which world tile was clicked
        const rect = gameContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const halfWidth = Math.floor(VIEWPORT_WIDTH / 2);
        const halfHeight = Math.floor(VIEWPORT_HEIGHT / 2);
        const startX = me.x - halfWidth;
        const startY = me.y - halfHeight;

        const tileX = Math.floor(clickX / TILE_SIZE) + startX;
        const tileY = Math.floor(clickY / TILE_SIZE) + startY;

        // 2. Check if the tile is adjacent to the player (not diagonal)
        const distX = Math.abs(me.x - tileX);
        const distY = Math.abs(me.y - tileY);

        if ((distX + distY) !== 1) {
            return; // Not adjacent
        }

        // 3. Check if the tile is a gatherable resource
        const tileType = getTileTypeFromState(tileX, tileY);
        if (tileType !== 'tree' && tileType !== 'rock') {
            return;
        }

        // 4. Start the action cooldown and send the interaction request
        startCooldown(ACTION_COOLDOWN);

        const msg = {
            type: 'interact',
            payload: { x: tileX, y: tileY }
        };
        ws.send(JSON.stringify(msg));
    }
});
