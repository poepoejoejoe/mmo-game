package main

import (
	"context"
	"github.com/gorilla/websocket"
)

// Client and Hub structs are now defined here, in the main package.
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	id   string
	send chan []byte
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

func (h *Hub) run() {
	go h.subscribeToWorldUpdates()

	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

func (h *Hub) subscribeToWorldUpdates() {
	ctx := context.Background()
	pubsub := rdb.Subscribe(ctx, "world_updates")
	defer pubsub.Close()
	ch := pubsub.Channel()

	for msg := range ch {
		h.broadcast <- []byte(msg.Payload)
	}
}
