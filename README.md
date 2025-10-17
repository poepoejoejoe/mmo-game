# Go + Redis 2D MMO Server

This project is a simple, scalable backend for a 2D grid-based massively multiplayer online game. It uses Go for the server logic, Redis for high-performance state management, and WebSockets for real-time communication with the front end.

The frontend is a modern TypeScript application built with Vite.

## 🚀 Technologies Used

* **Backend:** Go (Golang)
* **State Store:** Redis
* **Communication:** WebSockets
* **Frontend:** TypeScript, Vite

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

1.  **Go:** Version 1.18 or newer. ([Installation Guide](https://go.dev/doc/install))
2.  **Redis:** An active Redis instance. ([Installation Guide](https://redis.io/docs/getting-started/installation/))
3.  **Node.js:** Version 18 (LTS) or newer. ([Installation Guide](https://nodejs.org/))

## 🛠️ Setup and Running the Project

This project now has two distinct parts: the **Go backend** and the **Vite frontend**. You will need to run them in two separate terminals.

### Terminal 1: Running the Backend

1.  **Open a terminal** in the project's root directory (`mmo-game/`).
2.  **Start your Redis server** if it's not already running.
3.  **Use the run script** to build and start the Go server:
    ```bash
    .\run.bat
    ```
    The server will start on `http://localhost:8080`.

### Terminal 2: Running the Frontend

1.  **Open a second terminal** in the project's root directory.
2.  **Navigate into the client directory:**
    ```bash
    cd client
    ```
3.  **Install dependencies** (only needs to be done once):
    ```bash
    npm install
    ```
4.  **Start the Vite development server:**
    ```bash
    npm run dev
    ```
    The frontend server will start, likely on `http://localhost:5173`.

### 5. Play the Game!

Open your web browser and navigate to the address provided by the Vite server (e.g., **http://localhost:5173**). Do **not** go to the Go server's address.

The Vite server will serve the game, and its built-in proxy will automatically handle communicating with your Go backend.
