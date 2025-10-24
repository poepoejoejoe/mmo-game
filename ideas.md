# EON Game Ideas

## Core Gameplay Loop Expansion

**Goal:** Make the moment-to-moment gameplay engaging and give players short-term objectives.

### Completed
- [x] Slime as drawing
- [x] Inventory icons generated, heart chat emoji
- [x] AI gen all new better icons
- [x] Draw items that fall on the ground (or just use their icon probably)
- [x] Health bar?
- [x] Name the game. Improve the top bar with a image of the game title

### Current
- [ ] Give player a random shirt color
- [ ] Show the player holding the axe

### Backlog

#### Quests
- **Rewards:**
    - Armor
    - XP?
    - Gold?
- **Quest Ideas:**
    - Collect 10 wood make a wall
    - Make a fire and cook rat meat
    - Craft a crude axe

#### Experience
- OSRS like? WoW like?

#### Trading
- TBD

#### Talents
- Do talents just unlock stuff for your echo?

#### Echos
- Allow trading echoes. Setting trades for echos is like the AH system? e.g. your echo can say 12 wood for 1 box or something?
- Echos are based on xp what they do? or is it on events?
- Echos could just be based on talents?

### Ice box
- **PvP?**
    - Needs contested zones?

---

## Engineer Virality & Emergent Gameplay

This phase is about lowering the barrier to entry and creating systems that generate "unbelievable" stories.

### Ultra-Low Friction Access (The Viral Hook)

- **Guest Mode:** A player should be able to land on your website and be in-game within 5 seconds. No required sign-up. Assign them a random name ("Guest-1234").
- **Easy Account Conversion:** "Enjoying the game? Claim your name and save your progress by creating an account!"
- **Shareable Links:** Implement "Join my Alliance!" or "Teleport to Friend!" links. A friend clicks it, and it loads the game and spawns them near their friend (in a safe zone). This is the #1 way to get new users.

### Define World Zones

- **Safe Zones (Outer Ring):** No PvP. Basic resources (wood, stone, basic fiber). New players spawn here. This is the "safe" economy.
- **Contested Zones (Mid Ring):** Better resources (iron, special herbs). Limited, opt-in PvP (e.g., "flagging" for combat).
- **The Core (Center, around 0,0):** The best resources (rare crystals, enchanted wood), powerful NPCs, and potential "boss" spawns. Full, "always-on" PvP.

---

## Social Systems

**Goal:** Give players reasons to interact, collaborate, and bring their friends. This is the key to virality.

### Chat System

- **Action:** Implement a basic in-game chat with local (e.g., "say" in a 20-tile radius) and global channels.
- **Why:** The most fundamental social feature. An MMO without chat is a lonely place.

### Player Trading

- **Action:** Create a simple, secure UI for two players to trade items from their inventories.
- **Why:** Fosters a player-driven economy, specialization (e.g., "I'm a blacksmith, you're a woodcutter, let's trade"), and social bonds.

### Guilds / Factions

- **Action:** Allow players to form persistent groups ("Guilds"). Add guild chat, a shared guild bank, and a guild tag next to their name.
- **Why:** This is the #1 feature for long-term retention and virality. It creates social obligations, shared goals, and "us vs. them" narratives.

### Co-op & PvP Foundations

- **Action:** Introduce stronger "boss" NPCs that require multiple players. For PvP, you could designate specific world zones as "lawless" or allow consensual dueling.
- **Why:** Creates dynamic, player-driven content and drama, which makes for great stories that players share outside the game.

---

## The "Player Echo" System (Legacy & Asynchronous Play)

**The Idea:** When a player logs off, their character doesn't just vanish. An AI-driven "Echo" of that player spawns in the world, carrying on simple tasks based on their most common activities.

**How it Works:**

- **The Echo:** When you log off, your "Echo" appears, perhaps with a ghostly or "dreaming" visual. It wanders the world.
- **Recorded Behavior:** If you spent 80% of your time chopping trees in a specific forest, your Echo will be found there, chopping trees. If you were a guard, your Echo will patrol your guild's walls. If you were a crafter, your Echo will stand at their workbench, "practicing."
- **Interaction:** You can't kill these Echos (they're not "online"). But you can interact with them. Maybe you can "Dreamshare" with a logged-off Echo to trade an item, leaving it for them when they log in. Maybe you can "Learn" from a master crafter's Echo, gaining a tiny skill boost once per day.
- **Virality & Fun:** The world feels always populated. You'd see famous players' Echos and make "pilgrimages" to learn from them. It creates a 24/7 world and a sense of legacy. If you die, maybe your Echo becomes a "ghost" that haunts the place you died, creating player-driven lore.

---

## Technical Scaling

### Implement Scalable Zoning

- **Action:** This is the key to your architecture. Refine your Go backend so that you can run multiple Go server instances, with each instance responsible for one or more zones (e.g., Server 1 handles Zone 0, Server 2 handles Zone 1). When a player walks from Zone 0 to Zone 1, their WebSocket connection is seamlessly handed off from Server 1 to Server 2.
- **Why:** This is how you horizontally scale to an "insane" number of players. Your Redis database acts as the single source of truth, and you can just spin up more Go instances as your population grows.
