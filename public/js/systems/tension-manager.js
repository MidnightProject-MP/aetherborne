import CONFIG from '../config.js';

/**
 * Manages the game's tension level by listening to game events and calculating
 * the appropriate risk level for the player. It publishes changes to its state
 * via the event bus.
 * @class TensionManager
 */
class TensionManager {
    /**
     * @param {object} eventBus - The global event bus instance.
     */
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error("TensionManager requires an EventBus instance.");
        }

        /** @private */
        this.eventBus = eventBus;
        /** @private */
        this.levels = CONFIG.tension.levels;
        /** @private */
        this.currentLevelIndex = CONFIG.tension.defaultLevelIndex || 0;

        this._setupEventListeners();
        this._publishTensionChange(); // Publish initial state
    }

    /**
     * @returns {object} The configuration object for the current tension level.
     */
    get currentLevel() {
        return this.levels[this.currentLevelIndex];
    }

    /**
     * Subscribes the manager to all relevant global events.
     * @private
     */
    _setupEventListeners() {
        // Example logic: Increase tension based on the threat of enemy intents.
        this.eventBus.subscribe('intentsDeclared', (payload) => {
            const threateningIntents = payload.filter(intent => intent.type === 'attack').length;
            if (threateningIntents >= 2) {
                this._increaseTension();
            }
        });

        // Example logic: Decrease tension when an enemy is defeated.
        this.eventBus.subscribe('enemyDefeated', () => {
            this._decreaseTension();
        });
        
        // Example logic: Increase tension when the player takes a significant hit.
        this.eventBus.subscribe('entityHealthChanged', (payload) => {
            if (payload.entityId === 'player' && payload.changeAmount < 0) {
                 // You could add logic here based on percentage of health lost
                 this._increaseTension();
            }
        });
    }

    /**
     * Increases the tension level by one step, if not already at maximum.
     * @private
     */
    _increaseTension() {
        if (this.currentLevelIndex < this.levels.length - 1) {
            this.currentLevelIndex++;
            this._publishTensionChange(true);
        }
    }

    /**
     * Decreases the tension level by one step, if not already at minimum.
     * @private
     */
    _decreaseTension() {
        if (this.currentLevelIndex > 0) {
            this.currentLevelIndex--;
            this._publishTensionChange(true);
        }
    }
    
    /**
     * Publishes the current tension state to the event bus.
     * @param {boolean} [logChange=false] - Whether to also publish a combat log event.
     * @private
     */
    _publishTensionChange(logChange = false) {
        const tensionState = {
            levelIndex: this.currentLevelIndex,
            level: this.currentLevel
        };
        this.eventBus.publish('tensionChanged', tensionState);

        if (logChange) {
            this.eventBus.publish('combatLog', { 
                message: `Tension is now ${this.currentLevel.name}.`,
                type: 'tension' 
            });
        }
    }
}

export default TensionManager;
