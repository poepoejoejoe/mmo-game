package main

import (
	"encoding/json"
	"log"
	"mmo-game/game"
	"mmo-game/models"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer. If no pong is
	// received within this time, the connection is considered dead.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10
)

// upgrader handles the HTTP -> WebSocket protocol upgrade.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// We allow all origins for this simple development server.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// serveWs handles incoming websocket requests from clients.
func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	playerID := string(game.RedisKeyPlayerPrefix) + uuid.New().String()
	client := &Client{hub: hub, id: playerID, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	// Pass the new player's ID to the game logic to get their initial state.
	initialStateMsg := game.InitializePlayer(client.id)
	if initialStateMsg != nil {
		initialStateJSON, _ := json.Marshal(initialStateMsg)
		// Send the "welcome" packet to the newly connected client.
		client.send <- initialStateJSON
	}

	// Start the concurrent read and write loops for this client.
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the websocket connection to the game logic.
// It runs in its own goroutine for each connection.
func (c *Client) readPump() {
	// This defer block ensures cleanup happens when the loop exits (on disconnect).
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
		game.CleanupPlayer(c.id) // Tell the game logic to clean up the player.
	}()
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	// Main loop to read messages from the client.
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break // Exit the loop on error or disconnect.
		}

		var msg models.WebSocketMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		// Route the message to the appropriate game logic based on its type.
		switch game.ClientEventType(msg.Type) {
		case game.ClientEventMove:
			var moveData models.MovePayload
			if err := json.Unmarshal(msg.Payload, &moveData); err != nil {
				continue
			}
			// Call the game logic to process the move.
			correctionMsg := game.ProcessMove(c.id, game.MoveDirection(moveData.Direction))
			if correctionMsg != nil {
				// If the move was invalid, send a correction back to this client.
				correctionJSON, _ := json.Marshal(correctionMsg)
				c.send <- correctionJSON
			}

		case game.ClientEventInteract:
			// Call the game logic to process the interaction.
			correctionMsg, inventoryMsg := game.ProcessInteract(c.id, msg.Payload)
			if correctionMsg != nil {
				// If the interaction was invalid, send a correction.
				correctionJSON, _ := json.Marshal(correctionMsg)
				c.send <- correctionJSON
			}
			if inventoryMsg != nil {
				// If the interaction was successful, send an inventory update.
				inventoryJSON, _ := json.Marshal(inventoryMsg)
				c.send <- inventoryJSON
			}
		case game.ClientEventEquip:
			inventoryUpdate, gearUpdate := game.ProcessEquip(c.id, msg.Payload)
			if inventoryUpdate != nil {
				inventoryJSON, _ := json.Marshal(inventoryUpdate)
				c.send <- inventoryJSON
			}
			if gearUpdate != nil {
				gearJSON, _ := json.Marshal(gearUpdate)
				c.send <- gearJSON
			}
		case game.ClientEventUnequip:
			inventoryUpdate, gearUpdate := game.ProcessUnequip(c.id, msg.Payload)
			if inventoryUpdate != nil {
				inventoryJSON, _ := json.Marshal(inventoryUpdate)
				c.send <- inventoryJSON
			}
			if gearUpdate != nil {
				gearJSON, _ := json.Marshal(gearUpdate)
				c.send <- gearJSON
			}
		case game.ClientEventCraft:
			inventoryUpdate, correctionMsg := game.ProcessCraft(c.id, msg.Payload)
			if correctionMsg != nil {
				correctionJSON, _ := json.Marshal(correctionMsg)
				c.send <- correctionJSON
			}
			if inventoryUpdate != nil {
				inventoryJSON, _ := json.Marshal(inventoryUpdate)
				c.send <- inventoryJSON
			}
		case game.ClientEventPlaceItem:
			correctionMsg, inventoryMsg := game.ProcessPlaceItem(c.id, msg.Payload)
			if correctionMsg != nil {
				correctionJSON, _ := json.Marshal(correctionMsg)
				c.send <- correctionJSON
			}
			if inventoryMsg != nil {
				inventoryJSON, _ := json.Marshal(inventoryMsg)
				c.send <- inventoryJSON
			}
		case game.ClientEventAttack:
			var attackData models.AttackPayload
			if err := json.Unmarshal(msg.Payload, &attackData); err != nil {
				continue
			}
			damageMsg := game.ProcessAttack(c.id, attackData.EntityID)
			if damageMsg != nil {
				damageJSON, _ := json.Marshal(damageMsg)
				c.send <- damageJSON
			}
		case game.ClientEventEat:
			game.ProcessEat(c.id, msg.Payload)
		case game.ClientEventSendChat:
			game.ProcessSendChat(c.id, msg.Payload)
		}
	}
}

// writePump pumps messages from the hub (broadcasts) and private channels
// to the websocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel, so we close the connection.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			// Send a ping message to the client to keep the connection alive.
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
