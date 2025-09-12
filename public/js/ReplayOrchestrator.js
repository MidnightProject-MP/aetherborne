import { Game } from './game.js';
import CONFIG from './config.js';
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
        this.isPlaying = false;
        this.playbackSpeed = 1000; // ms per turn
        this.playbackTimeout = null;

        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.turnCounter = document.getElementById('turn-counter');
        this.statusMessage = document.getElementById('status-message');
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
            this.config = { ...CONFIG, ...dynamicConfig };

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
            this.config
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
        this.playPauseBtn.addEventListener('click', () => this.togglePlayback());
    }

    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.playPauseBtn.textContent = 'Pause';
            this.playNextTurn();
        } else {
            this.playPauseBtn.textContent = 'Play';
            if (this.playbackTimeout) {
                clearTimeout(this.playbackTimeout);
            }
        }
    }

    playNextTurn() {
        if (!this.isPlaying || this.currentTurn >= this.replayData.replayLog.length) {
            this.togglePlayback(); // Auto-pause at the end
            return;
        }

        this.executeTurn(this.currentTurn);
        this.currentTurn++;
        this.updateTurnCounter();

        this.playbackTimeout = setTimeout(() => this.playNextTurn(), this.playbackSpeed);
    }

    executeTurn(turnIndex) {
        const action = this.replayData.replayLog[turnIndex];
        const targetHex = this.gameInstance.gameMap.getTileByColRow(action.x, action.y);
        
        const payload = {
            type: 'move',
            sourceId: this.gameInstance.player.id,
            details: { targetTile: targetHex }
        };
        
        console.log(`[Replay] Turn ${turnIndex + 1}: Executing action`, payload);
        this.gameInstance.resolveEntityAction(payload);
    }

    updateTurnCounter() {
        this.turnCounter.textContent = `Turn: ${this.currentTurn} / ${this.replayData.replayLog.length}`;
    }

    showMessage(message) {
        this.statusMessage.textContent = message;
        this.statusMessage.style.display = 'block';
        this.statusMessage.style.backgroundColor = 'rgba(255, 255, 0, 0.8)';
    }

    showError(message) {
        this.statusMessage.textContent = message;
        this.statusMessage.style.display = 'block';
        this.statusMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    }

    hideMessage() {
        this.statusMessage.style.display = 'none';
    }
}