import CONFIG from './config.js';

/**
 * A data container for all state related to an active game session.
 * It tracks the turn cycle, map progression, and game-over status.
 * @class GameState
 */
export class GameState {
    constructor() {
        /**
         * The current phase of the turn cycle.
         * @type {'loading' | 'player' | 'enemies' | 'gameOver'}
         */
        this.currentTurn = 'loading';

        /**
         * A flag indicating if the game has ended.
         * @type {boolean}
         */
        this.isGameOver = false;

        /**
         * The ID of the current map being played.
         * @type {string}
         */
        this.currentMapId = CONFIG.prologueStartMapId || 'prologue_map_1';
        
        /**
         * The current turn number.
         * @type {number}
         */
        this.turnNumber = 1;
    }

    /**
     * Sets the game to a game-over state.
     */
    setGameOver() {
        this.isGameOver = true;
        this.currentTurn = 'gameOver';
    }

    /**
     * Resets the state for a new level or map, but preserves overall progress.
     */
    prepareForNewLevel() {
        this.currentTurn = 'loading';
        this.turnNumber = 1;
        // isGameOver and currentMapId are managed by the Game class.
    }
}
