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
import { startNewGame, getGameConfig, submitReplay, getPlayerData } from './apiService.js';

/**
 * Orchestrates the initialization sequence of the game.
 */
export class Orchestrator {
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

        this.bindEventHandlers();
        this.handleTransitionToSplash = this.handleTransitionToSplash.bind(this);
    }

    bindEventHandlers() {
        this.eventBus.subscribe('gameOver', this.handleGameOver.bind(this));
    }

    async handleGameOver(payload = {}) {
        console.log("[Orchestrator] Game Over event received:", payload.message);
        const playerName = payload.characterData?.name || "Anonymous Hero";

        // Also submit the replay for validation
        if (payload.replayData) {
            try {
                console.log("[Orchestrator] Submitting replay for validation...");
                // Get the final game state from the game instance in a format the server can verify.
                const finalStateClient = this.gameInstance.getSerializableState();
                const validationResult = await submitReplay(payload.replayData.sessionId, payload.replayData.replayLog, finalStateClient, playerName);
                console.log("[Orchestrator] Replay validation result:", validationResult);
            } catch (error) {
                console.error("[Orchestrator] Failed to submit replay:", error);
            }
        }
    }

    handleTransitionToSplash() {
        console.log("[Orchestrator] Handling transition to splash...");
        if (this.gameStateManager) {
            this.gameStateManager.transitionTo('SPLASH');
        } else {
            console.error("[Orchestrator] GameStateManager not available for transition!");
        }
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
                console.error(`[Orchestrator] Required DOM element with id "${id}" is missing.`);
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
            console.log("[Orchestrator] Start button found, attaching click handler");
            startBtn.addEventListener('click', () => {
                console.log('[Orchestrator] START button clicked. Publishing transitionToCharacterCreation event.');
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
            console.log("[Orchestrator] High Scores button found, attaching click handler");
            highScoresBtn.addEventListener('click', () => {
                console.log('[Orchestrator] High Scores button clicked. Displaying scores.');
                this.highScoreManager.displayHighScores();
            });
        } else {
            console.warn('[Orchestrator] High Scores button (high-scores-btn) not found!');
        }
    }

    /**
     * Wires up the continue button to load a default character and start the game.
     */
    wireContinueButton() {
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            console.log("[Orchestrator] Continue button found, attaching click handler");
            continueBtn.addEventListener('click', async () => {
                console.log('[Orchestrator] Continue button clicked. Loading default player data.');
                continueBtn.disabled = true;
                continueBtn.textContent = 'LOADING...';
                try {
                    const characterData = await getPlayerData('Player1');
                    this.eventBus.publish('characterCreated', characterData);
                } catch (error) {
                    console.error('[Orchestrator] Failed to load player data:', error);
                    continueBtn.disabled = false;
                    continueBtn.textContent = 'Continue';
                }
            });
        } else {
            console.warn('[Orchestrator] Continue button (continue-btn) not found!');
        }
    }

    /**
     * Creates the initialization sequence using an async generator.
     */
    async * createInitializationSequence() {
        // 1. Wait for DOM
        await this.waitForDOM();
        console.log("[Orchestrator] DOM is ready.");

        // 2. Initialize GameStateManager first and show the splash screen immediately.
        this.gameStateManager = await this.initializeGameStateManager();
        console.log("[Orchestrator] GameStateManager initialized.");
        await this.transitionToSplash();
        console.log("[Orchestrator] Transitioned to splash screen.");

        // NEW STEP: Fetch dynamic config from server and merge with static config.
        console.log("[Orchestrator] Fetching game configuration from server...");
        try {
            const dynamicConfig = await getGameConfig();
            this.config = { ...CONFIG, ...dynamicConfig };
            console.log("[Orchestrator] Game configuration loaded.");
        } catch (error) {
            console.error("[Orchestrator] CRITICAL: Failed to load game configuration from server.", error);
            // Here you could display a permanent error message on the screen.
            return; // Stop initialization
        }

        // Wire up splash screen button here
        this.wireSplashScreenStartButton();
        this.wireContinueButton();
        this.wireHighScoreButton();

        // 3. Initialize CharacterCreator with proper error handling
        console.log("[Orchestrator] Attempting CharacterCreator initialization...");
        this.characterCreator = await this.initializeCharacterCreator(this.config); // Pass config
        console.log("[Orchestrator] CharacterCreator result:", this.characterCreator);
        if (!this.characterCreator) {
            console.error("[Orchestrator] CharacterCreator creation failed. Aborting game startup.");
            return;
        }
        console.log("[Orchestrator] CharacterCreator successfully initialized and assigned.");

        // 4. Set up event handlers

        // 6. Wait for character creation
        const characterData = await this.waitForCharacterCreation();
        console.log("[Orchestrator] Character created.");

        // 7. Request a new game session from the server BEFORE creating the game instance.
        console.log("[Orchestrator] Requesting new game session from server...");
        // We hardcode 'map_01' for now. This could come from a map selection screen.
        const sessionData = await startNewGame(characterData.currentMapId || 'prologue_map_1', characterData);
        console.log("[Orchestrator] Session data received:", sessionData);

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

        // 10. Now, initialize the map layout and entities. This will use the systems we just set up.
        await this.gameInstance.initializeLayoutAndMap(characterData);
        if (!this.gameInstance.player) {
            console.error("[Orchestrator] Game instance failed to create player. Aborting.");
            return;
        }
        console.log("[Orchestrator] Game instance created and initialized.");

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
            console.warn('[Orchestrator] gameInstance.gameMap is not set when wiring PlayerHUD.');
        }
        if (!this.gameInstance.player) {
            console.warn('[Orchestrator] gameInstance.player is not set when wiring PlayerHUD.');
        }
        this.playerHUD.setGameMap(this.gameInstance.gameMap);
        this.playerHUD.setPlayer(this.gameInstance.player);
        this.playerHUD.updateTurnIndicator('player');
        console.log("[Orchestrator] PlayerHUD initialized and wired to game/player.");

        // Wire up the End Turn button. This logic would ideally be in PlayerHUD,
        // but adding it here ensures it's connected correctly.
        const endTurnButton = document.getElementById('end-turn-button');
        if (endTurnButton) {
            endTurnButton.addEventListener('click', () => {
                console.log("[Orchestrator] End Turn button clicked, publishing 'playerEndTurn'.");
                this.eventBus.publish('playerEndTurn');
            });
        }

        // 13. Signal ready
        await this.signalGameReady();
        console.log("[Orchestrator] Game Ready signal sent.");

        // Yield a final value if the for-await-of loop expects something.
        yield 'InitializationSequenceComplete';
    }

    /**
     * The main entry point to start the application's initialization sequence.
     * Called from main.js.
     */
    async start() {
        console.log("[Orchestrator] Starting initialization sequence...");
        for await (const step of this.initializationSequence) {
            // Each step is already executed in the generator, so we just iterate.
        }
        console.log("[Orchestrator] Initialization complete.");
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
            console.log("[Orchestrator] Creating GameStateManager...");
            const gameStateManager = new GameStateManager(this.eventBus);
            resolve(gameStateManager);
        });
    }

    /**
     * Initializes the CharacterCreator.
     */
    initializeCharacterCreator(config) {
        return new Promise((resolve) => {
            console.log("[Orchestrator] Starting CharacterCreator initialization...");
            const container = document.getElementById('character-creation-poc');
            
            if (!container) {
                console.error("[Orchestrator] Character creation container not found!");
                resolve(null);
                return;
            }

            try {
                const characterCreator = new CharacterCreator(container, this.eventBus, config);
                console.log("[Orchestrator] CharacterCreator local instance before resolve:", characterCreator);
                resolve(characterCreator); // Resolve with the created instance
            } catch (error) {
                console.error("[Orchestrator] Failed to create CharacterCreator:", error);
                resolve(null);
            }
        });
    }

    /**
     * Transitions the game state to the splash screen.
     */
    transitionToSplash() {
        return new Promise((resolve) => {
            console.log("[Orchestrator] Attempting transition to splash...");
            try {
                // this.gameStateManager is guaranteed to be set here
                this.gameStateManager.transitionTo('SPLASH');
                console.log("[Orchestrator] Successfully transitioned to SPLASH state.");
                resolve();
            } catch (error) {
                console.error("[Orchestrator] Error during splash transition:", error);
                resolve();
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