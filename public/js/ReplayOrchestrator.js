import Game from './game.js';
import { getReplay, getGameConfig } from './apiService.js';
import CONFIG from './config.js';
import StatusEffectSystem from './systems/statusEffectSystem.js';
import VisibilitySystem from './systems/visibilitySystem.js';
import TargetPreviewSystem from './systems/targetPreviewSystem.js';
import DetectionSystem from './systems/detectionSystem.js';
import IntentSystem from './systems/intentSystem.js';

export class ReplayOrchestrator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.gameInstance = null;
        this.replayData = null;
        this.config = null;
        this.currentTurn = 0;
        this.isPlaying = false;
        this.playInterval = null;
        this.playbackSpeed = 1000; // ms per turn, default 1x

        // UI Elements
        this.nextTurnBtn = document.getElementById('next-turn-btn');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.prevTurnBtn = document.getElementById('prev-turn-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.speedSelect = document.getElementById('speed-select');
        this.turnCounter = document.getElementById('turn-counter');
        this.statusMessage = document.getElementById('status-message');

        this.eventBus.subscribe('mapTransitionRequest', this.handleMapTransition.bind(this));
    }

    async start() {
        this.showMessage('Loading replay data...');
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('sessionId');

            if (!sessionId) {
                this.showError('No Session ID provided in URL.');
                return;
            }

            // Fetch both the replay data and the game config in parallel
            const [replayData, dynamicConfig] = await Promise.all([
                getReplay(sessionId),
                getGameConfig()
            ]);

            this.replayData = replayData;
            // The server sends a minimal `entityBlueprints` object. We must ignore it
            // and use the client's complete version from the local CONFIG.
            delete dynamicConfig.entityBlueprints;
            // Merge the dynamic config from the server with the static client config.
            this.config = { ...CONFIG, ...dynamicConfig };

            this.showMessage('Initializing game...');
            await this.initializeGame();
            this.hideMessage();

            this.bindUIControls();
            this.updateTurnCounter();
            this.updateButtonStates();

        } catch (error) {
            console.error('[ReplayOrchestrator] Failed to start replay:', error);
            this.showError(`Error: ${error.message}`);
        }
    }

    async initializeGame() {
        // Use the original character data from the session for accurate replay initialization.
        const characterData = this.replayData.initialCharacterData; 
        const sessionData = {
            sessionId: this.replayData.sessionId,
            seed: this.replayData.seed,
            mapTemplate: this.replayData.mapTemplate
        };

        this.gameInstance = new Game(
            this.eventBus,
            'map',
            this.config.grid.hexSize,
            characterData,
            null,
            sessionData,
            this.config,
            true // isReplay = true
        );

        // Initialize systems, similar to the main orchestrator
        this.gameInstance.setIntentSystem(new IntentSystem(this.eventBus, this.gameInstance));
        this.gameInstance.setDetectionSystem(new DetectionSystem(this.eventBus, this.gameInstance));
        this.gameInstance.setVisibilitySystem(new VisibilitySystem(this.eventBus, this.gameInstance));
        this.gameInstance.setStatusEffectSystem(new StatusEffectSystem(this.eventBus, this.gameInstance));
        new TargetPreviewSystem(this.eventBus, this.gameInstance, this.gameInstance.interactionModel);

        // Initialize the map and entities
        await this.gameInstance.initializeLayoutAndMap(characterData, sessionData.mapTemplate);
        console.log('[ReplayOrchestrator] Game instance created and initialized for replay.');
    }

    bindUIControls() {
        this.nextTurnBtn.addEventListener('click', () => {
            this.pause();
            this.stepForward();
        });
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.resetBtn.addEventListener('click', () => this.resetReplay());
        this.speedSelect.addEventListener('change', (e) => this.setSpeed(e.target.value));
    }

    /**
     * Executes the next turn in the replay log.
     */
    async stepForward() {
        if (this.currentTurn >= this.replayData.replayLog.length) {
            this.handleReplayEnd('Replay finished.');
            return;
        }

        // Disable controls during turn execution
        this.nextTurnBtn.disabled = true;
        this.playPauseBtn.disabled = true;

        const success = await this.executeTurn(this.currentTurn);

        if (success) {
            this.currentTurn++;
            this.updateTurnCounter();
        } else {
            this.handleReplayEnd(`Replay stopped: Invalid action detected at turn ${this.currentTurn + 1}.`, true);
            return;
        }

        this.updateButtonStates();

        if (this.currentTurn >= this.replayData.replayLog.length) {
            this.handleReplayEnd('Replay finished.');
        }
    }

    async executeTurn(turnIndex) {
        const action = this.replayData.replayLog[turnIndex];
        const deserializedAction = this._deserializeActionPayload(action);

        if (!deserializedAction) {
            console.error(`[Replay] Turn ${turnIndex + 1}: Could not deserialize action:`, action);
            return false;
        }
        
        console.log(`[Replay] Turn ${turnIndex + 1}: Executing action`, deserializedAction);
        return await this.gameInstance.resolveEntityAction(deserializedAction);
    }

    /**
     * Converts a serialized action from the log back into a usable payload.
     * @private
     */
    _deserializeActionPayload(action) {
        const deserialized = { ...action };
        if (deserialized.details.targetCoords) {
            const { q, r } = deserialized.details.targetCoords;
            const targetHex = this.gameInstance.gameMap.getTile(q, r);
            if (!targetHex) return null; // Invalid coords in log

            // Based on the action type, we need to set the correct property
            // that the Game engine's resolver expects. The live game's TargetPreviewSystem
            // uses 'targetHex' for skills and 'targetTile' for general input. We mirror that here.
            if (action.type === 'skill') {
                deserialized.details.targetHex = targetHex;
            } else { // For 'playerInput', 'move', etc.
                deserialized.details.targetTile = targetHex;
            }
            
            delete deserialized.details.targetCoords;
        }
        return deserialized;
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.play();
        } else {
            this.pause();
        }
    }

    play() {
        this.isPlaying = true;
        this.updateButtonStates();

        const loop = async () => {
            if (!this.isPlaying) return;

            await this.stepForward();

            if (this.isPlaying) { // Check again in case stepForward ended the replay
                this.playInterval = setTimeout(loop, this.playbackSpeed);
            }
        };
        loop();
    }

    pause() {
        this.isPlaying = false;
        clearTimeout(this.playInterval);
        this.playInterval = null;
        this.updateButtonStates();
    }

    async resetReplay() {
        this.pause();
        this.showMessage('Resetting replay...');
        this.currentTurn = 0;

        await this.initializeGame();

        this.updateTurnCounter();
        this.hideMessage();
        this.updateButtonStates();
    }

    setSpeed(speed) {
        this.playbackSpeed = parseInt(speed, 10);
    }

    async handleMapTransition({ nextMapId, entityId }) {
        if (this.gameInstance.player.id !== entityId) return;

        if (!nextMapId) {
            this.handleReplayEnd('Dungeon Completed! Replay finished.');
            return;
        }

        this.showMessage(`Transitioning to map: ${nextMapId}...`);

        try {
            const newMapTemplate = this.config.maps[nextMapId];
            if (!newMapTemplate) throw new Error(`Map template for '${nextMapId}' not found.`);

            // The ReplayOrchestrator is now in charge of the transition.
            // 1. Preserve the player.
            const playerToPreserve = this.gameInstance.player;
            // 2. Clean up the old map state.
            this.gameInstance._cleanupForTransition();
            // 3. Set the new map template and re-initialize the game instance.
            const newMapData = newMapTemplate.maptemplate;
            this.gameInstance.sessionData.mapTemplate = newMapData;
            await this.gameInstance.initializeLayoutAndMap(this.gameInstance.characterData, newMapData, playerToPreserve);
            
            this.hideMessage();
        } catch (error) {
            this.showError(`Failed to transition map: ${error.message}`);
        }
    }

    updateTurnCounter() {
        this.turnCounter.textContent = `Turn: ${this.currentTurn} / ${this.replayData.replayLog.length}`;
    }

    handleReplayEnd(message, isError = false) {
        this.pause(); // Ensure playback is stopped and buttons are updated
        if (isError) {
            this.showError(message, true);
        } else {
            this.showMessage(message, true);
        }
        this.playPauseBtn.disabled = true; // Final state: disable play
    }

    updateButtonStates() {
        const atEnd = this.currentTurn >= this.replayData.replayLog.length;
        const atStart = this.currentTurn === 0;

        if (this.isPlaying) {
            this.playPauseBtn.innerHTML = '⏸️ Pause';
            this.nextTurnBtn.disabled = true;
            this.resetBtn.disabled = true;
        } else {
            this.playPauseBtn.innerHTML = '▶️ Play';
            this.playPauseBtn.disabled = atEnd;
            this.nextTurnBtn.disabled = atEnd;
            this.resetBtn.disabled = atStart;
        }
        this.prevTurnBtn.disabled = true; // Always disabled for now
    }

    showMessage(message, isEnd = false) {
        this.statusMessage.innerHTML = ''; // Clear previous content
        const text = document.createElement('span');
        text.textContent = message;
        this.statusMessage.appendChild(text);

        if (isEnd) {
            this.addReturnToMenuButton();
        }

        this.statusMessage.style.display = 'block';
        this.statusMessage.style.backgroundColor = 'rgba(255, 255, 0, 0.8)';
    }

    showError(message, isEnd = false) {
        this.showMessage(message, isEnd); // Use showMessage to add the button
        this.statusMessage.style.display = 'block';
        this.statusMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    }

    hideMessage() {
        this.statusMessage.style.display = 'none';
    }

    addReturnToMenuButton() {
        const homeButton = document.createElement('button');
        homeButton.textContent = 'Return to Main Menu';
        homeButton.style.marginLeft = '20px';
        homeButton.onclick = () => { window.location.href = 'index.html'; };
        this.statusMessage.appendChild(homeButton);
    }
}