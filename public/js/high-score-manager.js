/**
 * @file high-score-manager.js
 * @description Manages fetching and displaying high scores.
 */

import { getHighScores } from './apiService.js';

export default class HighScoreManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }

    /**
     * Fetches high scores from the server and publishes an event with the result.
     */
    async fetchAndPublishScores() {
        try {
            const scores = await getHighScores();
            // The OverlayManager will listen for this event to display the scores.
            this.eventBus.publish('showHighScores', { scores });
        } catch (error) {
            console.error('[HighScoreManager] Failed to fetch high scores:', error);
            // Also publish on error so the UI can show a message.
            this.eventBus.publish('showHighScores', { error: 'Failed to load scores. Please try again.' });
        }
    }
}