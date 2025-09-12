/**
 * @file high-score-manager.js
 * @description Manages fetching and displaying high scores.
 */

import { getHighScores } from './apiService.js';

export default class HighScoreManager {
    constructor() {
        // This could be expanded to take a UI container element
    }

    /**
     * Fetches high scores from the server and renders them into the UI.
     */
    async displayHighScores() {
        const panel = document.getElementById('high-score-panel');
        const list = document.getElementById('high-score-list');

        if (!panel || !list) {
            console.error('[HighScoreManager] High score UI elements not found.');
            return;
        }

        list.innerHTML = '<li>Loading...</li>';
        panel.classList.remove('hidden');

        try {
            const scores = await getHighScores();
            list.innerHTML = ''; // Clear loading message

            if (scores.length === 0) {
                list.innerHTML = '<li>No high scores yet. Be the first!</li>';
                return;
            }

            scores.forEach(score => {
                const li = document.createElement('li');
                // If a sessionId exists, make it a link to the replay viewer.
                if (score.sessionId) {
                    li.innerHTML = `<a href="replay.html?sessionId=${score.sessionId}" target="_blank">${score.name} - ${score.score}</a>`;
                } else {
                    li.textContent = `${score.name} - ${score.score}`;
                }
                list.appendChild(li);
            });

        } catch (error) {
            console.error('[HighScoreManager] Failed to display high scores:', error);
            list.innerHTML = '<li>Error loading scores. Please try again.</li>';
        }
    }
}