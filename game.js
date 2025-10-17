document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const playerCoordsEl = document.getElementById('player-coords');
    const playerIdEl = document.getElementById('player-id');
    
    const ws = new WebSocket(`ws://${window.location.hostname}:8080/ws`);

    const VIEWPORT_WIDTH = 31;
    const VIEWPORT_HEIGHT = 21;
    const TILE_SIZE = 20;

    let clientState = {
        playerId: null,
        players: {},
        world: {} 
    };
    
    let canMove = true;
    const WATER_PENALTY = 500;
    const BASE_COOLDOWN = 100;

    ws.onopen = () => {
        console.log('Connected to the server.');
        playerCoordsEl.textContent = 'Connected! Waiting for world state...';
        document.addEventListener('keydown', handleKeyDown);
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        switch(msg.type) {
            case 'initial_state':
                clientState.playerId = msg.playerId;
                clientState.players = msg.players;
                clientState.world = msg.world;
                playerIdEl.textContent = `Your ID: ${msg.playerId}`;
                break;
            
            case 'state_correction':
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
        }
        
        renderViewport();
    };

    ws.onclose = () => {
        console.log('Disconnected from the server.');
        playerCoordsEl.textContent = 'Disconnected. Please refresh.';
        document.removeEventListener('keydown', handleKeyDown);
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        playerCoordsEl.textContent = 'Connection error.';
    };
    
    function getTileTypeFromState(x, y) {
        const key = `${x},${y}`;
        return clientState.world[key] || 'void';
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

    function handleKeyDown(e) {
        if (!canMove || !clientState.playerId) return;

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
            case 'up':    targetY--; break;
            case 'down':  targetY++; break;
            case 'left':  targetX--; break;
            case 'right': targetX++; break;
        }

        // --- NEW: Client-side prediction for player collision ---
        // Loop through all known players to see if the target tile is occupied.
        console.log(clientState)
        for (const id in clientState.players) {
            const p = clientState.players[id];
            console.log(p)
            if (p.x === targetX && p.y === targetY) {
                console.log('blocked')
                return; 
            }
        }
        // --- End of new collision check ---

        const targetTileType = getTileTypeFromState(targetX, targetY);
        if (targetTileType === 'rock' || targetTileType === 'tree' || targetTileType === 'void') {
            return;
        }

        // Optimistically move the player on the client
        me.x = targetX;
        me.y = targetY;
        renderViewport();

        let cooldown = BASE_COOLDOWN;
        if (targetTileType === 'water') {
            cooldown = WATER_PENALTY;
        }
        canMove = false;
        setTimeout(() => { canMove = true; }, cooldown);
        
        const msg = {
            type: 'move',
            payload: { direction: direction }
        };
        ws.send(JSON.stringify(msg));
    }
});
