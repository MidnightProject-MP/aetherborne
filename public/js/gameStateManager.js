/**
 * Manages the different states of the game and handles transitions between them.
 * It ensures that only one screen element is visible at a time using the '.active' class
 * and notifies other components when the game state changes.
 * @class GameStateManager
 */
export class GameStateManager {
    /**
     * @param {object} eventBus - The global event bus instance.
     */
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error("GameStateManager requires an EventBus instance.");
        }

        /** @private */
        this.eventBus = eventBus;
        
        /** @private */
        this.currentState = null;
        
        /** @private */
        this.states = {
            SPLASH: 'SPLASH',
            CHARACTER_CREATION: 'CHARACTER_CREATION',
            GAME_MAP: 'GAME_MAP'
        };

        /**
         * A map of state names to their corresponding DOM elements.
         * Fetched once on initialization to avoid repeated DOM queries.
         * @private
         */
        this.screenElements = {
            [this.states.SPLASH]: document.getElementById('splash-screen-content'),
            [this.states.CHARACTER_CREATION]: document.getElementById('character-creation-poc'),
            [this.states.GAME_MAP]: document.getElementById('map-flow-poc')
        };
        
        // Subscribe to external events that trigger state changes.
        this.eventBus.subscribe('characterCreated', () => this.transitionTo(this.states.GAME_MAP));
        this.eventBus.subscribe('transitionToCharacterCreation', () => {
            console.log("[GameStateManager] Received transitionToCharacterCreation event");
            this.transitionTo(this.states.CHARACTER_CREATION);
        });
    }

    /**
     * Centralized private method to manage which screen is visible.
     * It adds the '.active' class to the target screen and removes it from all others.
     * @param {string} activeState - The state to make active.
     * @private
     */
    #setActiveScreen(activeState) {
        for (const state in this.screenElements) {
            const element = this.screenElements[state];
            if (element) {
                if (state === activeState) {
                    element.classList.add('active');
                } else {
                    element.classList.remove('active');
                }
            }
        }
    }

    /**
     * Transitions the game to a new state, updates the UI, and notifies listeners.
     * @param {string} newState - The name of the state to transition to.
     */
    transitionTo(newState) {
        if (!this.states[newState]) {
            console.error(`[GameStateManager] Invalid state: ${newState}`);
            return;
        }

        if (newState === this.currentState) {
            console.log(`[GameStateManager] Already in state ${newState}, ignoring transition.`);
            return;
        }

        const oldState = this.currentState;
        console.log(`[GameStateManager] Transitioning from ${oldState} to ${newState}`);
        
        // 1. Update the internal state
        this.currentState = newState;
        
        // 2. Update the UI by setting the active screen
        this.#setActiveScreen(newState);

        // 3. Notify the rest of the application about the change
        this.eventBus.publish('gameStateChanged', { newState, oldState });
    }
}