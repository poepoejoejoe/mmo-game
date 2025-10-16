# Go + Redis 2D MMO Server

This project is a simple, scalable backend for a 2D grid-based massively multiplayer online game. It uses Go for the server logic, Redis for high-performance state management, and WebSockets for real-time communication with the front end.

This serves as a foundational example of a modern, authoritative game server architecture.

---

## 🚀 Technologies Used

* **Backend:** Go (Golang)
* **State Store:** Redis
* **Communication:** WebSockets (`gorilla/websocket` library)
* **Frontend:** HTML, CSS, and vanilla JavaScript

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed on your system:

1.  **Go:** Version 1.18 or newer. ([Installation Guide](https://go.dev/doc/install))
2.  **Redis:** The server needs an active Redis instance to connect to. ([Installation Guide](https://redis.io/docs/getting-started/installation/))

---

## 🛠️ Setup and Running the Project

Follow these steps to get the game server and client running on your local machine.


### 1. Start Redis

Make sure your Redis server is running. If you installed it locally, you can typically start it by running the `redis-server` command in your terminal. You should see the Redis logo and a confirmation that the server is running.



### 2. Install Go Dependencies and Run!

Open a terminal or command prompt in your project directory and run the `go mod tidy` command. This will read your `go.mod` file and automatically download the required libraries (`redis`, `websocket`, `uuid`).

```bash
go mod tidy
go run .

