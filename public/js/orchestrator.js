import { GameStateManager } from './gameStateManager.js';
import { CharacterCreator } from './characterCreator.js';
import Game from './game.js';
import CONFIG from './config.js';
import StatusEffectSystem from './systems/statusEffectSystem.js';
import VisibilitySystem from './systems/visibilitySystem.js';
import TargetPreviewSystem from './systems/targetPreviewSystem.js';
import DetectionSystem from './systems/detectionSystem.js';
import IntentSystem from './systems/intentSystem.js';
import PlayerHUD from './ui/playerHUD.js';
import { startNewGame, getGameConfig, submitReplay, getPlayerData, updatePlayerState } from './apiService.js';

/**
 * Orchestrates the initialization sequence of the game.
 */
export class LiveGameOrchestrator {
    constructor(eventBus, highScoreManager) {
        this.eventBus = eventBus;
        this.highScoreManager = highScoreManager;
        this.gameStateManager = null;
        this.characterCreator = null;
        this.intentSystem = null;
        this.gameInstance = null;
        this.targetPreviewSystem = null;
        this.statusEffectSystem = null;
        this.detectionSystem = null; // New: DetectionSystem instance
        this.visibilitySystem = null;
        this.initializationSequence = this.createInitializationSequence();
        this.config = null; // Will hold the merged game configuration
        this.replayLog = [];
        this.sessionId = null;

        this.bindEventHandlers();
    }

    bindEventHandlers() {
        this.eventBus.subscribe('gameOver', this.handleGameOver.bind(this));
        this.eventBus.subscribe('returnToMainMenu', this.handleReturnToMainMenu.bind(this));
        this.eventBus.subscribe('entityAction', this.handleEntityAction.bind(this));
    }

    /**
    * Converts an action payload with object references to a serializable version for the replay log.
    * @param {object} payload - The action payload from the event bus.
    * @returns {object} A serializable copy of the payload.
    * @private
    */
    _serializeActionPayload(payload) {
        const serializable = JSON.parse(JSON.stringify(payload)); // Deep copy to be safe
        if (payload.details.targetTile) {
            serializable.details.targetCoords = {
                q: payload.details.targetTile.q,
                r: payload.details.targetTile.r
            };
            delete serializable.details.targetTile;
        }
        // Also handle targetHex for skills
        if (payload.details.targetHex) {
            serializable.details.targetCoords = {
                q: payload.details.targetHex.q,
                r: payload.details.targetHex.r
            };
            delete serializable.details.targetHex;
        }
        return serializable;
    }

    handleEntityAction(payload) {
        // Only log actions performed by the player.
        if (this.gameInstance?.player?.id === payload.sourceId) {
            const serializablePayload = this._serializeActionPayload(payload);
            this.replayLog.push(serializablePayload);
            console.log('[LiveGameOrchestrator] Player action logged for replay.', serializablePayload);
        }
    }

    async handleGameOver(payload = {}) {
        console.log("[LiveGameOrchestrator] Game Over event received:", payload.message);
        const playerName = payload.characterData?.name || "Anonymous Hero";

        // Submit the replay for validation using the orchestrator's log.
        if (this.sessionId && this.replayLog.length > 0) {
            try {
                console.log("[LiveGameOrchestrator] Submitting replay for validation...");
                // The client no longer sends its final state. The server calculates it from the replay.
                const validationResult = await submitReplay(this.sessionId, this.replayLog, playerName);
                console.log("[LiveGameOrchestrator] Replay validation result:", validationResult);
            } catch (error) {
                console.error("[LiveGameOrchestrator] Failed to submit replay:", error);
            }
        } else {
            console.log("[LiveGameOrchestrator] No replay data to submit.");
        }

        // Player state saving is now handled entirely by the server upon replay validation.
        // The client's responsibility ends here.
    }

    handleReturnToMainMenu() {
        console.log("[LiveGameOrchestrator] Returning to main menu...");
        // The simplest and most robust way to reset the entire game state and go back to the start.
        window.location.reload();
    }

    /**
     * Checks for all required DOM elements before starting the game.
     * Returns true if all are present, false otherwise.
     */
    checkRequiredDomElements() {
        const requiredIds = [
            'character-creation-poc',
            'splash-screen',
            'game-map',
            'map-container',
            'hp-bar-fill',
            'hp-bar-text',
            'mp-bar-fill',
            'mp-bar-text',
            'ap-bar-text',
            'skill-bar',
            'tension-level',
            'turn-indicator',
            'end-turn-button'
        ];
        let allPresent = true;
        for (const id of requiredIds) {
            if (!document.getElementById(id)) {
                console.error(`[LiveGameOrchestrator] Required DOM element with id "${id}" is missing.`);
                allPresent = false;
            }
        }
        return allPresent;
    }

    /**
     * Wires up the splash screen START button to trigger character creation.
     */
    wireSplashScreenStartButton() {
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            console.log("[LiveGameOrchestrator] Start button found, attaching click handler");
            startBtn.addEventListener('click', () => {
                console.log('[LiveGameOrchestrator] START button clicked. Publishing transitionToCharacterCreation event.');
                this.eventBus.publish('transitionToCharacterCreation');
            });
        }
    }

    /**
     * Wires up the high scores button to trigger fetching and displaying scores.
     */
    wireHighScoreButton() {
        // NOTE: This assumes a button with id 'high-scores-btn' exists on the splash screen.
        const highScoresBtn = document.getElementById('high-scores-btn');
        if (highScoresBtn) {
            console.log("[LiveGameOrchestrator] High Scores button found, attaching click handler");
            highScoresBtn.addEventListener('click', () => {
                console.log('[LiveGameOrchestrator] High Scores button clicked. Fetching scores.');
                this.highScoreManager.fetchAndPublishScores();
            });
        } else {
            console.warn('[LiveGameOrchestrator] High Scores button (high-scores-btn) not found!');
        }
    }

    /**
     * Wires up the continue button to load a default character and start the game.
     */
    wireContinueButton() {
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            console.log("[LiveGameOrchestrator] Continue button found, attaching click handler");
            continueBtn.addEventListener('click', async () => {
                console.log('[LiveGameOrchestrator] Continue button clicked. Loading default player data.');
                continueBtn.disabled = true;
                continueBtn.textContent = 'LOADING...';
                try {
                    const characterData = await getPlayerData('Player1');
                    this.eventBus.publish('characterCreated', characterData);
                } catch (error) {
                    console.error('[LiveGameOrchestrator] Failed to load player data:', error);
                    continueBtn.disabled = false;
                    continueBtn.textContent = 'Continue';
                }
            });
        } else {
            console.warn('[LiveGameOrchestrator] Continue button (continue-btn) not found!');
        }
    }

    /**
     * Creates the initialization sequence using an async generator.
     */
    async * createInitializationSequence() {
        // 1. Wait for DOM
        await this.waitForDOM();
        console.log("[LiveGameOrchestrator] DOM is ready.");

        // 2. Initialize GameStateManager first and show the splash screen immediately.
        this.gameStateManager = await this.initializeGameStateManager();
        console.log("[LiveGameOrchestrator] GameStateManager initialized.");
        this.gameStateManager.transitionTo('SPLASH');
        console.log("[LiveGameOrchestrator] Commanded transition to SPLASH state.");

        // --- UI Feedback for Loading ---
        const continueBtn = document.getElementById('continue-btn');
        const newGameBtn = document.getElementById('start-btn');
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.textContent = 'Loading...';
        }
        if (newGameBtn) {
            newGameBtn.disabled = true;
            newGameBtn.textContent = 'Loading...';
        }

        // Fetch dynamic config from server.
        console.log("[LiveGameOrchestrator] Fetching game configuration from server...");
        try {
            const dynamicConfig = await getGameConfig();
            // The server sends a minimal `entityBlueprints` object for its own validation purposes.
            // The client has a complete version in its local CONFIG file.
            // To prevent the server's minimal version from overwriting the client's full version,
            // we delete it from the server's response before merging the configurations.
            delete dynamicConfig.entityBlueprints;

            this.config = { ...CONFIG, ...dynamicConfig }; // Merge server data (sheets) with local static data (blueprints).
            console.log("[LiveGameOrchestrator] Game configuration loaded.");

            // --- Restore UI on Success ---
            if (continueBtn) {
                continueBtn.disabled = false;
                continueBtn.textContent = 'Continue';
            }
            if (newGameBtn) {
                newGameBtn.disabled = false;
                newGameBtn.textContent = 'New Game';
            }
        } catch (error) {
            console.error("[LiveGameOrchestrator] CRITICAL: Failed to load game configuration from server.", error);
            if (continueBtn) continueBtn.textContent = 'Error';
            if (newGameBtn) newGameBtn.textContent = 'Error';
            return; // Stop initialization
        }

        // Wire up splash screen button here
        this.wireSplashScreenStartButton();
        this.wireContinueButton();
        this.wireHighScoreButton();

        // 3. Initialize CharacterCreator with proper error handling
        console.log("[LiveGameOrchestrator] Attempting CharacterCreator initialization...");
        this.characterCreator = await this.initializeCharacterCreator(this.config); // Pass config
        console.log("[LiveGameOrchestrator] CharacterCreator result:", this.characterCreator);
        if (!this.characterCreator) {
            console.error("[LiveGameOrchestrator] CharacterCreator creation failed. Aborting game startup.");
            return;
        }
        console.log("[LiveGameOrchestrator] CharacterCreator successfully initialized and assigned.");

        // 4. Set up event handlers

        // 6. Wait for character creation
        console.log("[LiveGameOrchestrator] Now waiting for user to create a character or continue...");
        const initialCharacterData = await this.waitForCharacterCreation();
        console.log("[LiveGameOrchestrator] Character created.");

        // 7. Request a new game session from the server BEFORE creating the game instance.
        console.log("[LiveGameOrchestrator] Requesting new game session from server...");
        // The server now returns the authoritative session AND character data.
        const authoritativeSession = await startNewGame(initialCharacterData.currentMapId || 'prologue_map_1', initialCharacterData);
        console.log("[LiveGameOrchestrator] Authoritative session data received:", authoritativeSession);
        this.sessionId = authoritativeSession.sessionId;

        // Use the data returned from the server, not the initial data.
        // This is the core of the security fix.
        const characterData = authoritativeSession.characterData;
        const sessionData = { 
            sessionId: authoritativeSession.sessionId, 
            seed: authoritativeSession.seed, 
            mapTemplate: authoritativeSession.mapTemplate 
        };

        // 8. Create Game instance directly here, now with server-authoritative session data.
        this.gameInstance = new Game(
            this.eventBus,
            'map',
            this.config.grid.hexSize,
            characterData,
            null, // intentSystem is set below
            sessionData, // Pass the new session data
            this.config // Pass the full merged config
        );

        // 9. Initialize all game systems and set them on the Game instance BEFORE initializing the map.
        // This ensures they are available during the map setup process.
        this.intentSystem = new IntentSystem(this.eventBus, this.gameInstance);
        this.gameInstance.setIntentSystem(this.intentSystem);
        this.detectionSystem = new DetectionSystem(this.eventBus, this.gameInstance);
        this.gameInstance.setDetectionSystem(this.detectionSystem);
        this.visibilitySystem = new VisibilitySystem(this.eventBus, this.gameInstance);
        this.gameInstance.setVisibilitySystem(this.visibilitySystem);
        this.statusEffectSystem = new StatusEffectSystem(this.eventBus, this.gameInstance);
        this.gameInstance.setStatusEffectSystem(this.statusEffectSystem);
        this.targetPreviewSystem = new TargetPreviewSystem(this.eventBus, this.gameInstance, this.gameInstance.interactionModel);

        // 10. Now, initialize the map layout and entities, passing the authoritative map template.
        await this.gameInstance.initializeLayoutAndMap(characterData, sessionData.mapTemplate);
        if (!this.gameInstance.player) {
            console.error("[LiveGameOrchestrator] Game instance failed to create player. Aborting.");
            return;
        }
        console.log("[LiveGameOrchestrator] Game instance created and initialized.");

        // 11. Set up PlayerInputComponent event listeners
        if (this.gameInstance.player) {
            const playerInputComp = this.gameInstance.player.getComponent('playerInput');
            if (playerInputComp) {
                this.eventBus.subscribe('playerAttemptSkill', (payload) => {
                    if (payload.entityId === this.gameInstance.player.id) {
                        const skillsComponent = this.gameInstance.player.getComponent('skills');
                        const skillInstance = skillsComponent.getSkill(payload.skillId);
                        if (skillInstance) {
                            playerInputComp.handleSkillActivationAttempt(skillInstance);
                        }
                    }
                });
            }
        }
        // 12. Initialize PlayerHUD and wire up references
        this.playerHUD = new PlayerHUD(this.eventBus);
        // Defensive: check before wiring
        if (!this.gameInstance.gameMap) {
            console.warn('[LiveGameOrchestrator] gameInstance.gameMap is not set when wiring PlayerHUD.');
        }
        if (!this.gameInstance.player) {
            console.warn('[LiveGameOrchestrator] gameInstance.player is not set when wiring PlayerHUD.');
        }
        this.playerHUD.setGameMap(this.gameInstance.gameMap);
        this.playerHUD.setPlayer(this.gameInstance.player);
        this.playerHUD.updateTurnIndicator('player');
        console.log("[LiveGameOrchestrator] PlayerHUD initialized and wired to game/player.");

        // Wire up the End Turn button. This logic would ideally be in PlayerHUD,
        // but adding it here ensures it's connected correctly.
        const endTurnButton = document.getElementById('end-turn-button');
        if (endTurnButton) {
            endTurnButton.addEventListener('click', () => {
                console.log("[LiveGameOrchestrator] End Turn button clicked, publishing 'playerEndTurn'.");
                this.eventBus.publish('playerEndTurn');
            });
        }

        // 13. Signal ready
        await this.signalGameReady();
        console.log("[LiveGameOrchestrator] Game Ready signal sent.");

        // Yield a final value if the for-await-of loop expects something.
        yield 'InitializationSequenceComplete';
    }

    /**
     * The main entry point to start the application's initialization sequence.
     * Called from main.js.
     */
    async start() {
        console.log("[LiveGameOrchestrator] Starting initialization sequence...");
        for await (const step of this.initializationSequence) {
            // Each step is already executed in the generator, so we just iterate.
        }
        console.log("[LiveGameOrchestrator] Initialization complete.");
    }

    /**
     * Waits for the DOM to be fully loaded.
     */
    waitForDOM() {
        return new Promise(resolve => 
            {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", resolve);
            } else {
                resolve();
            }
        });
    }

    /**
     * Initializes the GameStateManager.
     */
    initializeGameStateManager() {
        return new Promise(resolve => {
            console.log("[LiveGameOrchestrator] Creating GameStateManager...");
            const gameStateManager = new GameStateManager(this.eventBus);
            resolve(gameStateManager);
        });
    }

    /**
     * Initializes the CharacterCreator.
     */
    initializeCharacterCreator(config) {
        return new Promise((resolve) => {
            console.log("[LiveGameOrchestrator] Starting CharacterCreator initialization...");
            const container = document.getElementById('character-creation-poc');
            
            if (!container) {
                console.error("[LiveGameOrchestrator] Character creation container not found!");
                resolve(null);
                return;
            }

            try {
                const characterCreator = new CharacterCreator(container, this.eventBus, config);
                console.log("[LiveGameOrchestrator] CharacterCreator local instance before resolve:", characterCreator);
                resolve(characterCreator); // Resolve with the created instance
            } catch (error) {
                console.error("[LiveGameOrchestrator] Failed to create CharacterCreator:", error);
                resolve(null);
            }
        });
    }

    /**
     * Waits for the character to be created.
     */
    waitForCharacterCreation() {
        return new Promise(resolve => {
            this.eventBus.subscribe('characterCreated', (characterData) => {
                resolve(characterData);
            });
        });
    }

    /**
     * Signals that the game is ready to start.
     */
    signalGameReady() {
        return new Promise(resolve => {
            this.eventBus.publish('gameMapReady');
            resolve();
        });
    }
}