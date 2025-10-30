# Horizontal Scaling Plan

This document outlines a refined plan for evolving the game server from a single monolith to a horizontally scalable, multi-server architecture. The primary goal is to support a larger world and more players while ensuring a consistent and smooth user experience, especially at the boundaries between servers.

### 1. Decompose into Services

The monolithic server will be broken down into a set of specialized, communicating services.

*   **Zone Servers:** The existing application will be repurposed to become a "Zone Server." Multiple instances of this service will run, each managing the moment-to-moment gameplay of a specific world area (a "zone").
*   **Gateway Service:** A new, lightweight service will handle initial player connections, authentication, and direct players to the correct Zone Server based on their character's last known location.
*   **Chat Service (New Priority):** A simple, dedicated service will be created to handle global chat and whispers. Zone servers will publish messages to it, and it will broadcast them back to all other zone servers. Zone-local "say" chat will remain within each Zone Server.

### 2. World Partitioning & Shared State

The game world and its data will be structured to support a distributed environment.

*   **Coordinate-Based Zoning:** All Redis keys will be parameterized by zone coordinates (e.g., `zone:1:2:positions`). This coordinate-based system (`zone:<x>:<y>:<key>`) makes it easy to reason about adjacent zones.
*   **Shared Persistent State:** All persistent player and world data (character info, inventory, world geometry) will be stored in a central Redis instance accessible by all services. This makes Zone Servers primarily responsible for real-time game logic, not long-term data storage.

### 3. Player and Entity Handoff

Mechanisms will be put in place to manage entities moving between zones.

*   **Player Handoff:** A "perceptually seamless" handoff will be used for players crossing zone boundaries. The process involves the client doing a quick reconnect via the Gateway Service, which is orchestrated by the servers to be unnoticeable to the player.
*   **AI/Echo Handoff (Leashing):** For the initial implementation, **AI-controlled entities will not cross zone boundaries.** All NPCs and player Echos will have "leashing" logic that forces them to path back toward their origin point if they stray too far. This prevents them from triggering a complex zone handoff, drastically reducing implementation complexity while being an acceptable and standard game mechanic.

### 4. Cross-Zone Interactions

Fluid interaction across zone boundaries is critical for a seamless experience.

*   **Action Forwarding:** An "RPC over Redis Pub/Sub" pattern will be used for all direct player actions that target entities or tiles in an adjacent zone (e.g., attacking an NPC, gathering a resource). The action is sent to the authoritative server for the target's zone for processing.
*   **Boundary Data Stream:** Zone servers will continuously publish the IDs and positions of all entities within a "boundary buffer" area to a zone-specific Redis channel (e.g., `boundary-updates:1:2`). Adjacent servers will subscribe to this stream.
*   **AI Awareness:** The `buildTickCache` function in the AI loop will be modified. In addition to fetching local entities, it will also incorporate the entity data from the boundary streams of its neighbors. This allows NPCs to "see" and "target" players across a border, even if they cannot chase them.

### 5. Cross-Zone Pathfinding

Pathfinding will be handled pragmatically to manage complexity.

*   **Zone-Restricted Pathfinding:** For the initial implementation, the player's `find-path` action will be restricted to their current zone. If the target coordinates are outside the current zone's boundaries, the action will fail gracefully with a user-facing message like, "Cannot find path to a different zone." A more advanced global pathfinding system that can route players across multiple zones can be implemented as a future project.
