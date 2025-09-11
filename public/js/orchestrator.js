import { GameStateManager } from './gameStateManager.js';
import { CharacterCreator } from './characterCreator.js';
import Game from './game.js';
import CONFIG from './config.js'; 
// import MapOverlayManager from './ui/mapOverlayManager.js'; // MapOverlayManager is now integrated into SVGRenderer
import StatusEffectSystem from './systems/statusEffectSystem.js';
import VisibilitySystem from './systems/visibilitySystem.js';
import TargetPreviewSystem from './systems/targetPreviewSystem.js';
import DetectionSystem from './systems/detectionSystem.js'; // New: Import DetectionSystem
import IntentSystem from './systems/intentSystem.js';
import PlayerHUD from './ui/playerHUD.js';

/**
 * Orchestrates the initialization sequence of the game.
 */
export class Orchestrator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.gameStateManager = null;
        this.characterCreator = null;
        this.intentSystem = null;
        this.gameInstance = null;
        this.targetPreviewSystem = null;
        this.statusEffectSystem = null;
        this.detectionSystem = null; // New: DetectionSystem instance
        this.visibilitySystem = null;
        // this.mapOverlayManager = null; // No longer needed, as SVGRenderer handles overlays
        this.initializationSequence = this.createInitializationSequence();
        this.handleTransitionToSplash = this.handleTransitionToSplash.bind(this);
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
        } else {
            console.warn('[Orchestrator] START button not found!');
        }
    }

    /**
     * Creates the initialization sequence using an async generator.
     */
    async * createInitializationSequence() {
        // 1. Wait for DOM
        await this.waitForDOM();
        console.log("[Orchestrator] DOM is ready.");

        // Wire up splash screen button here
        this.wireSplashScreenStartButton();

        // 2. Initialize GameStateManager first
        this.gameStateManager = await this.initializeGameStateManager();
        console.log("[Orchestrator] GameStateManager initialized.");

        // 3. Initialize CharacterCreator with proper error handling
        console.log("[Orchestrator] Attempting CharacterCreator initialization...");
        this.characterCreator = await this.initializeCharacterCreator();
        console.log("[Orchestrator] CharacterCreator result:", this.characterCreator);
        if (!this.characterCreator) {
            console.error("[Orchestrator] CharacterCreator creation failed. Aborting game startup.");
            return;
        }
        console.log("[Orchestrator] CharacterCreator successfully initialized and assigned.");

        // 4. Set up event handlers
        //this.eventBus.subscribe('transitionToSplash', this.handleTransitionToSplash);

        // 5. Continue with game initialization
        await this.transitionToSplash();
        console.log("[Orchestrator] Transitioned to splash screen.");

        // 6. Wait for character creation
        const characterData = await this.waitForCharacterCreation();
        console.log("[Orchestrator] Character created.");

        // 7. Create Game instance directly here
        this.gameInstance = new Game(
            this.eventBus,
            'map',
            CONFIG.grid.hexSize,
            characterData
        );

        // 8. Initialize all game systems and set them on the Game instance BEFORE initializing the map.
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

        // 9. Now, initialize the map layout and entities. This will use the systems we just set up.
        await this.gameInstance.initializeLayoutAndMap(characterData);
        if (!this.gameInstance.player) {
            console.error("[Orchestrator] Game instance failed to create player. Aborting.");
            return;
        }
        console.log("[Orchestrator] Game instance created and initialized.");

        // 10. Set up PlayerInputComponent event listeners
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
        
        // 11. Initialize PlayerHUD and wire up references
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

        // 12. Signal ready
        await this.signalGameReady();
        console.log("[Orchestrator] Game Ready signal sent.");

        // Yield a final value if the for-await-of loop expects something.
        yield 'InitializationSequenceComplete';

    }

    /**
     * Starts the initialization sequence.
     */
    async start() {
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
    initializeCharacterCreator() {
        return new Promise((resolve) => {
            console.log("[Orchestrator] Starting CharacterCreator initialization...");
            const container = document.getElementById('character-creation-poc');
            
            if (!container) {
                console.error("[Orchestrator] Character creation container not found!");
                resolve(null);
                return;
            }

            try {
                const characterCreator = new CharacterCreator(container, this.eventBus);
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