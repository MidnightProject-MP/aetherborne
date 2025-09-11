/**
 * @file high-score-manager.js
 * @description Manages fetching and submitting high scores using the apiService.
 */

import { getHighScores, submitScore } from './apiService.js';

const HighScoreManager = {
    // Example function to be called by your UI to display scores
    async displayHighScores() {
        try {
            console.log("Fetching high scores from server...");
            const scores = await getHighScores();
            console.log("Scores received:", scores);
            // TODO: Add your code here to render the scores in the UI.
            // For example, find an element and populate it with the score data.
            // const scoreList = document.getElementById('high-score-list');
            // scoreList.innerHTML = scores.map(s => `<li>${s.name}: ${s.score}</li>`).join('');
        } catch (error) {
            console.error("Could not display high scores:", error);
            // TODO: Show an error message in the UI.
        }
    },

    // Example function to be called when a game ends
    async savePlayerScore(playerName, score) {
        try {
            console.log(`Submitting score for ${playerName}: ${score}`);
            await submitScore(playerName, score);
            console.log("Score submitted successfully.");
        } catch (error) {
            console.error("Could not submit high score:", error);
        }
    }
};

export default HighScoreManager;