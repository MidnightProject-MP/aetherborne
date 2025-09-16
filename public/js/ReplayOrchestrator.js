import { Game } from './game.js';
import { getReplay, getGameConfig } from './apiService.js';
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

        // The only control is the "Next Turn" button.
        this.nextTurnBtn = document.getElementById('next-turn-btn');
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
            this.config = { ...dynamicConfig }; // Config now fully comes from server

            this.showMessage('Initializing game...');
            await this.initializeGame();
            this.hideMessage();

            this.bindUIControls();
            this.updateTurnCounter();

        } catch (error) {
            console.error('[ReplayOrchestrator] Failed to start replay:', error);
            this.showError(`Error: ${error.message}`);
        }
    }

    async initializeGame() {
        // For replay, character data is not needed as entities are created from the map template
        const characterData = { name: 'Replay Hero' }; 
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
        await this.gameInstance.initializeLayoutAndMap(characterData);
        console.log('[ReplayOrchestrator] Game instance created and initialized for replay.');
    }

    bindUIControls() {
        this.nextTurnBtn.addEventListener('click', () => this.nextTurn());
    }

    /**
     * Executes the next turn in the replay log.
     */
    async nextTurn() {
        if (this.currentTurn >= this.replayData.replayLog.length) {
            this.handleReplayEnd('Replay finished.');
            return;
        }

        const success = await this.executeTurn(this.currentTurn);

        if (success) {
            this.currentTurn++;
            this.updateTurnCounter();
        } else {
            this.handleReplayEnd(`Replay stopped: Invalid action detected at turn ${this.currentTurn + 1}.`, true);
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
            const targetTile = this.gameInstance.gameMap.getTile(q, r);
            if (!targetTile) return null; // Invalid coords in log

            deserialized.details.targetTile = targetTile;
            delete deserialized.details.targetCoords;
        }
        return deserialized;
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
            this.gameInstance.sessionData.mapTemplate = newMapTemplate;
            await this.gameInstance.initializeLayoutAndMap(this.gameInstance.characterData, playerToPreserve);
            
            this.hideMessage();
        } catch (error) {
            this.showError(`Failed to transition map: ${error.message}`);
        }
    }

    updateTurnCounter() {
        this.turnCounter.textContent = `Turn: ${this.currentTurn} / ${this.replayData.replayLog.length}`;
    }

    handleReplayEnd(message, isError = false) {
        if (isError) {
            this.showError(message, true);
        } else {
            this.showMessage(message, true);
        }
        this.nextTurnBtn.disabled = true;
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