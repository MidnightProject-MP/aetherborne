// import { GameState } from './gameState.js'; // Assuming GameState is moved to its own file
// import { Layout, Point } from './tile.js';
// import GameMap from './map.js';
// import EntityFactory from './entity-factory.js';
// import CONFIG from './config.js';

// /**
//  * The central game class, responsible for orchestrating the main game loop,
//  * managing game state, and resolving actions by listening to the event bus.
//  * @class Game
//  */
// export default class Game {
//     /**
//      * @param {object} eventBus The global event bus instance.
//      * @param {string} canvasId The ID of the canvas element for the map.
//      * @param {object} gridSize The size of the grid (e.g., {x: 20, y: 20}).
//      * @param {object} hexSize The size of the hexes in pixels.
//      * @param {object} characterData The initial data for the player character.
//      */
//     constructor(eventBus, canvasId, gridSize, hexSize, characterData) {
//         /** @type {object} */
//         this.eventBus = eventBus;
//         /** @type {string} */
//         this.canvasId = canvasId;
//         /** @type {Layout} */
//         this.layout = new Layout(Layout.flat, hexSize, new Point(24, -83));
//         /** @type {GameState} */
//         this.gameState = new GameState();
//         /** @type {GameMap} */
//         this.gameMap = new GameMap(gridSize, this.layout, this);
//         /** @type {EntityFactory} */
//         this.entityFactory = new EntityFactory(this);
        
//         /** @type {object|null} The player entity. */
//         this.player = null;

//         this.initializeGame(characterData);
//     }

//     /**
//      * Sets up the initial game state, loads the map, creates entities,
//      * and subscribes to core game events.
//      * @param {object} characterData - The data for the player character.
//      * @private
//      */
//     async initializeGame(characterData) {
//         this.setupEventListeners();
        
//         // Create the player entity from the character creation data
//         this.player = this.entityFactory.createEntity('player', null, characterData);
//         this.gameState.currentMapId = characterData.currentMapId || CONFIG.prologueStartMapId;
        
//         await this.loadMap(this.gameState.currentMapId);
        
//         // Start the first turn
//         this.startNewRound();
//     }
    
//     /**
//      * Loads a map and its entities based on a map ID from the configuration.
//      * @param {string} mapId - The ID of the map to load.
//      * @private
//      */
//     async loadMap(mapId) {
//         this.eventBus.publish('combatLog', { message: `Loading map: ${mapId}` });
        
//         const mapConfig = CONFIG.prologueMapData.find(map => map.id === mapId);
//         if (!mapConfig) {
//             console.error(`Map configuration not found for ID: ${mapId}`);
//             this.handleGameOver("Error: Could not load map data.");
//             return;
//         }

//         // Initialize map tiles
//         this.gameMap.initializeTiles(mapConfig.gridSize || CONFIG.grid.size);

//         // Place player
//         const playerStartPos = mapConfig.playerStart || CONFIG.player.startHex;
//         this.player.hex = this.gameMap.getTile(playerStartPos.q, playerStartPos.r);
        
//         // Create map entities (obstacles, enemies, etc.)
//         const entities = (mapConfig.entities?.enemies || []).map(enemyConfig => 
//             this.entityFactory.createEntity(enemyConfig.type, this.gameMap.getTile(enemyConfig.q, enemyConfig.r), enemyConfig)
//         );
//         this.gameMap.setupTiles(mapConfig.entities?.portals, mapConfig.entities?.obstacles, entities);

//         // Render everything
//         this.gameMap.renderHexGrid();
//         this.player.updateVisualPosition();
//         this.gameMap.enemies.forEach(e => e.updateVisualPosition());
        
//         // Update player's sight
//         this.player.getComponent('lineOfSight')?.compute();
//     }

//     /**
//      * Subscribes the Game instance to all relevant events on the event bus.
//      * @private
//      */
//     setupEventListeners() {
//         this.eventBus.subscribe('entityAction', (payload) => this.resolveentityAction(payload));
//         this.eventBus.subscribe('playerTurnEnded', () => this.endPlayerTurn());
//         this.eventBus.subscribe('allIntentsResolved', () => this.startNewRound());
//         this.eventBus.subscribe('enemyDefeated', (payload) => this.handleEntityDeath(payload.entityId));
//     }
    
//     /**
//      * Starts a new round of combat.
//      * This is the entry point for the main game loop.
//      * @private
//      */
//     startNewRound() {
//         if (this.gameState.isGameOver) return;
        
//         console.log("--- NEW ROUND ---");
//         this.eventBus.publish('turnStarted', { turnNumber: this.gameState.turnNumber++ });
//     }

//     /**
//      * Ends the player's turn and signals for the enemy intent phase to begin.
//      * @private
//      */
//     endPlayerTurn() {
//         if (this.gameState.currentTurn !== 'player' || this.gameState.isGameOver) return;
        
//         console.log("Player turn ended. Starting enemy turn sequence.");
//         this.gameState.currentTurn = 'enemies';
//         this.eventBus.publish('enemiesTurnEnded'); // Kicks off the IntentSystem
//     }

//     /**
//      * Processes a committed player action from the event bus.
//      * @param {object} payload - The entityAction event payload.
//      * @private
//      */
//     resolveentityAction(payload) {
//         if (this.gameState.currentTurn !== 'player' || this.gameState.isGameOver) return;

//         console.log("Resolving player action:", payload);
//         const { type, sourceId, details } = payload;
//         const player = this.getEntity(sourceId);
        
//         if (!player) return;

//         // Delegate to a more specific handler based on action type
//         switch(type) {
//             case 'skill':
//                 this.resolveSkillAction(player, details);
//                 break;
//             case 'move':
//                 this.resolveMoveAction(player, details);
//                 break;
//             // Add other action types like 'item', 'defend', etc.
//         }
        
//         // After any action, check if the player's turn should automatically end
//         this.checkPlayerTurnConditions();
//     }

//     /**
//      * Resolves a skill-based action.
//      * @private
//      */
//     resolveSkillAction(player, details) {
//         const { skillId, targetHex } = details;
//         const skillsComponent = player.getComponent('skills');
        
//         if (skillsComponent?.canUseSkill(skillId)) {
//             skillsComponent.useSkill(skillId, targetHex);
//             // The `useSkill` method would contain the logic to calculate effects
//             // and emit events like `entityHealthChanged` or `applyStatusEffect`.
//         } else {
//             this.eventBus.publish('combatLog', { message: "Cannot use that skill now.", type: "error" });
//         }
//     }

//     /**
//      * Resolves a movement action.
//      * @private
//      */
//     resolveMoveAction(player, details) {
//         const movementComponent = player.getComponent('movement');
//         const targetTile = this.gameMap.getTile(details.targetTile.q, details.targetTile.r);
        
//         if (movementComponent?.canMoveTo(targetTile)) {
//             movementComponent.moveTo(targetTile);
//         } else {
//             this.eventBus.publish('combatLog', { message: "Cannot move there.", type: "error" });
//         }
//     }

//     /**
//      * Checks if the player's turn should end due to lack of AP or defeat.
//      * @private
//      */
//     checkPlayerTurnConditions() {
//         const stats = this.player.getComponent('stats');
//         if (!stats.isAlive()) {
//             this.handleGameOver("Player has been defeated!");
//             return;
//         }
//         if (stats.actionPoints <= 0) {
//             this.eventBus.publish('combatLog', { message: "Out of action points.", type: "info-dim" });
//             this.endPlayerTurn();
//         }
//     }

//     /**
//      * Handles the logic for an entity's death.
//      * @param {string} entityId - The ID of the defeated entity.
//      * @private
//      */
//     handleEntityDeath(entityId) {
//         const entity = this.getEntity(entityId);
//         if (!entity) return;

//         this.eventBus.publish('combatLog', { message: `${entity.name} has been defeated!`, type: "death" });

//         if (entity.type === 'player') {
//             this.handleGameOver("Player has been slain!");
//         } else {
//             this.gameMap.removeEnemy(entity);
//             // Award score, etc.
//             if (this.gameMap.enemies.length === 0) {
//                  this.eventBus.publish('combatLog', { message: "All enemies defeated!", type: "event" });
//                  // Logic for level clear, portal activation, etc.
//             }
//         }
//     }

//     /**
//      * Ends the game and shows the final score overlay.
//      * @param {string} message - The reason for the game ending.
//      * @private
//      */
//     handleGameOver(message) {
//         if (this.gameState.isGameOver) return;
//         this.gameState.setGameOver(true);
//         console.log('%cGAME OVER!', "color: red; font-size: 1.5em;", message);
//         this.eventBus.publish('gameOver', { message });
//     }

//     /**
//      * Retrieves an entity instance by its ID.
//      * @param {string} entityId 
//      * @returns {object|null} The entity instance or null if not found.
//      */
//     getEntity(entityId) {
//         if (this.player && this.player.id === entityId) {
//             return this.player;
//         }
//         return this.gameMap.enemies.find(e => e.id === entityId) || null;
//     }
// }
