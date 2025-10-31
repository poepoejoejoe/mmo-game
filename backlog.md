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
- [x] Give player a random shirt color
- [x] Show the player holding the axe
- [x] image generation needs to crop the transparent images after doing the transparency
- Fix the way the ui panels in bottom left work.
- Now I want to make a second quest that is only available after the player finishes the first quest. In this quest the wizard asks the player to make cooked rat meat after slaying a rat. The wizard comes up for a good reason for this.
- need to fix data driven design quest check in action_interact.go
- quest indicator when quest is avail. quest complete turn in indicator?
- need xp icons
- need echo icon
- need a resonance bar
- need to address echo performance and concurrency
- echos can't recharge resonance when in echo form?
- need to think about dying over all, and as echo. i think just respawn at sanctuary
- make the third quest not about chopping trees but about being stronger to kill slimes better.
- have the 4th quest explain better how resonance and echo form work. when you log out your echo will take over. any experience you gather throughout noria will resonate with you, or as you resonate with the land and gain experience this will charge your echo
- path finding movement for player
- detached camera and smoother movement
- player constructed things like wooden wall slowly decay
- resources replenish
- remove the outline from the slime and rat. keep their eyes, but with a little thinner line

### Current
- bank
Let's work on making a banker (each sanctuary needs to have a banker) WE should add a concept of friendly npc (the wizard is friendly as well). We can make sure the wizard and golem banker share some property that excludes them from being considered in ai.go.

Let's make it so that when you interact with the golem banker it doesn't open dialog but opens a bank window right away. The bank window should be very similar to the way inventory is displayed. Items shoudl stack very high (almost inf) in the bank, when you left click an item from the bank or inventory it moves one of that item to or from the bank / inventory. Now we need to add a right click context menu for the bank, this allows us to withdrawn 1, 5 10 or X. X optino should open a very small window to allow us to type the amount. Only when the bank is open, if the player right click's their inventory there is a context window that is basically the same as previously stated but it says deposit, 1 5 10 or X. IF the player walks away from the banker the bank window closes. The bank should have 64 slots in a 8 by 8 grid for now. For testing have player spawn with some random stacks of items in their bank


drag and drop in inventory inventory
there is a bug with unequiping gear. When you click the item from the gear tab it should unequip the item and that item should go to the players inventory (if its not full)

there should be an inventory full small little red errors message somewhere on the screen

there is a bug with trying to deposit an equipable item like the axe (probaly the helmet too). When the bank is open, the binidng to equip those items should be disabled, so the user should see the deposit click behaviors for those items.

remember the state the inventory was in. So if we open the bank and our inventory was closed, the inventory opens but then when we walk away from the bank and the bank closes the inventory should close as well. However, if we walk up to the bank and inventory was open, then when we walk away from the bank and the bank closes the inventory should stay open.


there is a bug where after i die, i cannot move around (i think its a client state issue?)



- echo well
- echos and defend (minor rune?)
- echos can loot (minor rune?)



### Alpha Backlog
- hosting / deploys / monitoring (?)
- pvp
- discord
- ad for designers
- a few simple talents

### minor backlog
- escape closes all open windows?
- could use a better shield icon / defense icon

## Idea backlog
- if you're echo stays logged out for a certain amount of time, you can get items or recipes 
- bows and arrows
- bombs / throwables
- magic (magic is utility mostly, little dmg?)
- dark magic (?) can only use magic and get little utility but good damage
- some kind of bank in the sanctuary lol?

### Echo ideas
- echos and defending themselves?
- a repair block rune, echos will repair their guild's placed walls

### Ui improvements
- when you gather resource show icon over inventory. When you equip gear show icon over gear button. When you unequip show icon over inventory

### Unlock UI Ideas
- We should introduce the concept of the ui becoming unlocked as the player does the first couple quests. The first quest should unlock the inventory (in the ui only) as well as the crafting area.
- The wizard should explain that experience and the experience menu item should unlock after the first quest
- The gear menu item should unlock after accepting the third quest which requires you to create an axe
- We should improve the quest a_lingering_will after finishing the quest it should unlock the runes menu button in the ui, chop trees and mine ore. Finishin the quest also unlocks the toggle echo button in the ui as well as the resonance bar.

### Player Knowledge
- Do we need a binding explanation? make the 5th quest about setting your binding and explain player death resets to binding. the 4th quest also needs to explain that we are in a sactuary and the sanctuary causes us to be in our etheral form, no building and players can move through eachother, unlike the rest of the world.

#### Sounds / Music
lol

### Ice box
- PVP
- Talent system

### Known bug / issues
When scaling world size past 180 there is an issue with the long / lad geo radius redis finding. We would need to normalize values to get that to work.

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

## Sanctuaries, Echos, and Anti-Griefing

This section outlines the implementation of two distinct but related systems: the "Ethereal State" property for preventing player-trapping in safe areas, and the "Echo State" mode for player-controlled AI automation.

### 1. The Ethereal State (A Property of Sanctuaries)

The primary solution to griefing and player-trapping in crowded hubs.

-   **Concept:** The "Ethereal State" is not a mode a player enters, but rather a property automatically granted to any character (player- or AI-controlled) standing on a Sanctuary tile.
-   **Primary Effect:** The Ethereal State allows a character to pass through other characters, disabling player-to-player collision.
-   **Cost:** This is a passive effect of the zone and has no resource cost.

### 2. The Echo State (AI Automation)

The system for allowing players to automate tasks.

-   **Concept:** A manually activated mode where an AI takes control of the player's character.
-   **Activation:** Can be toggled on/off by the player anywhere in the world. An Echo can enter and operate within Sanctuaries.
-   **AI Control via Runes:** The Echo's behavior is determined by "Runes" that the player equips and a dedicated UI.
-   **Resource Cost:** The Echo State's uptime is fueled by "Resonance," a resource generated by gaining Experience (XP).

#### Rune System Details

##### AI Complexity and Scope

The core design principle for Runes is that they **automate repetitive *actions*, not complex *outcomes*.** The player's role is to handle strategy and problem-solving (like clearing a dangerous area); the Echo's role is to handle the tedious, repetitive task that follows.

A task is suitable for a Rune if it is a single, repeatable action (e.g., `Chop`, `Mine`, `Attack`) that requires simple targeting of the nearest valid object and standard pathfinding. The AI will not solve puzzles, use items from inventory, or complete quests.

##### Rune Slots and Future Plans

-   **Initial Implementation (Single Rune):** To begin, a player will only be able to activate **one** Rune at a time. This gives the Echo a single, clear "job" to perform.
-   **Future Expansion (Major/Minor System):** The system is designed with future expansion in mind. The long-term goal is to implement a "Major/Minor" Rune slot system to allow for more complex and customized Echo behaviors.
    -   **Major Rune Slot:** This would define the Echo's primary **action** or goal (e.g., `Woodcutting`, `Mining`). This is what the Echo does when idle.
    -   **Minor Rune Slots:** These would add passive or reactive **behaviors** that augment the primary action (e.g., `Guarding` (fights back if attacked) or `Scavenging` (picks up loot)).
    -   **Example:** A `Mining` Major Rune combined with a `Guarding` Minor Rune would create an Echo that mines ore by default but will stop to defend itself if attacked.

##### Acquiring Runes

Runes will be discoverable through a variety of in-game activities to reward different playstyles.

-   **Quest Rewards:** The introductory quest for the Echo system will reward the player with their first choice of a basic gathering Rune, ensuring all players can engage with the system.
-   **Crafting:** Most standard Runes will be craftable by players with appropriate artisan skills, creating a player-driven economy for automation.
-   **Rare Drops:** The most powerful and efficient "Masterwork" Runes will be rare drops from high-level content, such as world bosses or dungeon chests, creating a treasure-hunting incentive for advanced players.

### 3. Sanctuary Mechanics: Phasing and Building Restrictions

The core anti-griefing mechanics are tied to the properties of Sanctuary tiles.

-   **Concurrent States:** A character can be in the Echo State and the Ethereal State simultaneously. For example, an AI-controlled Echo that walks into a Sanctuary will become Ethereal and gain the ability to pass through other characters.
-   **Phasing Source:** The ability to phase through other characters comes *only* from the Ethereal State, which is granted by being on a Sanctuary tile.
-   **Building Restriction:** Player construction on Sanctuary tiles is prohibited. The check must validate that the *target tile* for the construction is not a Sanctuary tile, preventing a player from standing just outside the zone and building into it.

### 4. Sanctuary Zones

Procedurally generated hubs that grant the Ethereal State property to characters within them.

-   **Zone Definition:** The world generator will create "Sanctuary" landmarks and flag their tiles. A starting Sanctuary will always be at the world's origin.

### 5. "Return to Sanctuary" Ability

An immersive, in-world travel and safety tool centered around a physical object in each Sanctuary.

-   **The Sanctuary Stone:** Each Sanctuary will contain a special, interactable statue called a Sanctuary Stone.
-   **Binding:** Interacting with the Lodestone will open a UI menu to set it as their home teleport point.
-   **Return Ability:** The player will have an ability called "Return to Sanctuary" that initiates the teleport after a channel time.
-   **Cooldown:** The ability will have a long cooldown (e.g., 30 minutes).

### 6. Client-Side Considerations

-   **Rune Management UI:** A new UI for players to configure the Runes for their Echo State.
-   **Differentiated Visuals:** To ensure clarity, each state will have a unique visual effect.
    -   **Ethereal State:** Will be indicated by a soft, golden aura on the ground beneath the player and a very slight character transparency.
    -   **Echo State:** Will have a more pronounced ghostly effect, with high character transparency and a desaturated, monochromatic color palette.

---

## Technical Scaling

### Implement Scalable Zoning

- **Action:** This is the key to your architecture. Refine your Go backend so that you can run multiple Go server instances, with each instance responsible for one or more zones (e.g., Server 1 handles Zone 0, Server 2 handles Zone 1). When a player walks from Zone 0 to Zone 1, their WebSocket connection is seamlessly handed off from Server 1 to Server 2.
- **Why:** This is how you horizontally scale to an "insane" number of players. Your Redis database acts as the single source of truth, and you can just spin up more Go instances as your population grows.

---

## Experience and Talent System

The progression system will be based on earning talent points to unlock specific bonuses, rather than having levels directly gate content.

### Earning XP:
Performing an action (e.g., chopping a tree, crafting an item) grants XP in the relevant skill.

### Gaining Talent Points:
When a skill levels up, the player earns one Talent Point for that skill's specific talent tree.

### Spending Talent Points:
Players can spend these points to unlock talents that provide passive bonuses. This allows for customized character progression.

### Proposed Skills

#### Gathering Skills

- **Woodcutting:** Chop trees for logs.
- **Mining:** Mine ores from rocks.

#### Artisan Skills

- **Smithing:** Smelt ores and create metal gear.
- **Cooking:** Cook food for healing and buffs.
- **Construction:** Build structures.

#### Combat Skills

- **Attack:** Melee damage.
- **Defense:** Damage reduction.

### Example Talents

Below are some examples of what these talents could look like for each skill.

#### Gathering Skills

- **Woodcutting:**
    - **Tough Bark:** Increases your chance of finding rare wood types from any tree.
    - **Lumberjack's Vigor:** Grants a chance to gather extra wood from each tree.
    - **Axe Specialization:** Increases chopping speed with all axes.
- **Mining:**
    - **Rich Veins:** Increases your chance of finding additional ore.
    - **Geologist's Luck:** Grants a chance to find valuable gems while mining.
    - **Efficient Swinging:** Increases mining speed with all pickaxes.

#### Artisan Skills

- **Smithing:**
    - **Reinforced Forging:** Improves the durability of weapons and armor you smith.
    - **Master Smelter:** Increases the yield from smelting ore.
    - **Efficient Smith:** Reduces the material cost for smithing items.
- **Cooking:**
    - **Master Chef:** Increases the potency and duration of buffs from food you cook.
    - **Waste Not:** Reduces the chance of burning food.
    - **Hearty Meals:** Cooked food provides more healing.
- **Construction:**
    - **Structural Integrity:** Increases the durability and health of structures you build.
    - **Resourceful Architect:** Provides a chance to save materials when constructing something.
    - **Swift Builder:** Increases the speed at which you build structures.

#### Combat Skills

- **Attack:**
    - **Weapon Finesse:** Increases critical strike chance with all melee weapons.
    - **Sword Specialization:** Increases damage and accuracy when using swords.
    - **Brute Force:** Increases overall melee damage by a small percentage.
- **Defense:**
    - **Shield Block:** Increases the effectiveness of blocking with a shield.
    - **Reinforced Plating:** Increases the defensive value of all worn armor.
    - **Last Stand:** Grants a defense boost when your health is low.