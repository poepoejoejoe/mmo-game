package main

import (
	"encoding/json"
	"log"
	"mmo-game/game"
	"mmo-game/models"
	"net/http"
	"time"

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
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}

	// We don't register the client with the hub until they have successfully logged in.
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

		// The first message must be a login message.
		if c.id == "" {
			if game.ClientEventType(msg.Type) != game.ClientEventLogin {
				log.Println("Client sent non-login message before authenticating. Closing connection.")
				break
			}
			var loginData models.LoginPayload
			if err := json.Unmarshal(msg.Payload, &loginData); err != nil {
				log.Printf("Error unmarshalling login payload: %v", err)
				break
			}

			playerID, initialState := game.LoginPlayer(loginData.SecretKey)
			if initialState != nil {
				c.id = playerID
				c.hub.register <- c
				initialStateJSON, _ := json.Marshal(initialState)
				c.send <- initialStateJSON
			}

		} else { // Client is already logged in, handle other messages.
			// --- NEW: Player Action Disables Echo ---
			handlePlayerActionDisablesEcho(c, msg)
			// --- END NEW ---

			switch game.ClientEventType(msg.Type) {
			case game.ClientEventRegister:
				var registerData models.RegisterPayload
				if err := json.Unmarshal(msg.Payload, &registerData); err != nil {
					log.Printf("Error unmarshalling register payload: %v", err)
					continue
				}
				registeredMsg, initialState := game.RegisterPlayer(c.id, registerData.Name)
				if registeredMsg != nil {
					registeredJSON, _ := json.Marshal(registeredMsg)
					c.send <- registeredJSON
				}
				if initialState != nil {
					initialStateJSON, _ := json.Marshal(initialState)
					c.send <- initialStateJSON
				}
			case game.ClientEventMove:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
					// Broadcast messages are handled by ProcessMove internally
				}

			case game.ClientEventInteract:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
				}
			case game.ClientEventEquip:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
				}
			case game.ClientEventUnequip:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
				}
			case game.ClientEventCraft:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
				}
			case game.ClientEventPlaceItem:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
				}
			case game.ClientEventAttack:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
					// Broadcast messages are handled by ProcessAttack internally
				}
			case game.ClientEventEat:
				// Use the action registry for standardized processing
				result := game.HandleAction(game.ClientEventType(msg.Type), c.id, msg.Payload)
				if result != nil && result.Success {
					// Send messages to the player
					for _, msg := range result.ToPlayer {
						msgJSON, _ := json.Marshal(msg)
						c.send <- msgJSON
					}
				}
			case game.ClientEventLearnRecipe:
				game.ProcessLearnRecipe(c.id, msg.Payload)
			case game.ClientEventSendChat:
				game.ProcessSendChat(c.id, msg.Payload)
			case game.ClientEventDialogAction:
				game.ProcessDialogAction(c.id, msg.Payload)
			case game.ClientEventToggleEcho:
				game.ProcessToggleEcho(c.id)
			case game.ClientEventSetRune:
				game.ProcessSetRune(c.id, msg.Payload)
			case game.ClientEventTeleport:
				game.ProcessTeleport(c.id, msg.Payload)
			case game.ClientEventFindPath:
				var findPathData models.FindPathPayload
				if err := json.Unmarshal(msg.Payload, &findPathData); err != nil {
					log.Printf("Error unmarshalling find_path payload: %v", err)
					continue
				}
				noValidPathMsg, validPathMsg := game.ProcessFindPath(c.id, findPathData)
				if noValidPathMsg != nil {
					noValidPathJson, _ := json.Marshal(noValidPathMsg)
					c.send <- noValidPathJson
				}
				if validPathMsg != nil {
					validPathJson, _ := json.Marshal(validPathMsg)
					c.send <- validPathJson
				}
			case game.ClientEventDepositItem:
				inventoryMsg, bankMsg := game.ProcessDepositItem(c.id, msg.Payload)
				if inventoryMsg != nil {
					inventoryJSON, _ := json.Marshal(inventoryMsg)
					c.send <- inventoryJSON
				}
				if bankMsg != nil {
					bankJSON, _ := json.Marshal(bankMsg)
					c.send <- bankJSON
				}
			case game.ClientEventWithdrawItem:
				inventoryMsg, bankMsg := game.ProcessWithdrawItem(c.id, msg.Payload)
				if inventoryMsg != nil {
					inventoryJSON, _ := json.Marshal(inventoryMsg)
					c.send <- inventoryJSON
				}
				if bankMsg != nil {
					bankJSON, _ := json.Marshal(bankMsg)
					c.send <- bankJSON
				}
			}
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

// handlePlayerActionDisablesEcho checks if a player action should disable the echo state.
func handlePlayerActionDisablesEcho(c *Client, msg models.WebSocketMessage) {
	eventType := game.ClientEventType(msg.Type)

	// Rune-related actions should not disable the echo state.
	if eventType == game.ClientEventToggleEcho || eventType == game.ClientEventSetRune {
		return
	}

	// This is a bit inefficient to fetch the data here again, but it's the cleanest
	// place to put this logic without tangling it in every single game action.
	playerData, err := game.GetEntityData(c.id)
	if err != nil {
		return
	}

	if isEcho, _ := playerData["isEcho"]; isEcho == "true" {
		log.Printf("Player %s performed an action, disabling echo state.", c.id)
		game.SetEchoState(c.id, false)
	}
}
