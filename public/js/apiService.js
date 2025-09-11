/**
 * @file apiService.js
 * @description Centralized service for all communication with the Google Apps Script backend.
 */

// IMPORTANT: Replace this with your actual Web App URL from the Apps Script editor deployment.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx_E0nLuFmvt00b1BBgKBjcm_uH6mWWo26t77yFDIk-cq97hicPXoOUDIinnB-5CFaHRQ/exec";

/**
 * Fetches the top high scores from the server.
 * @returns {Promise<Array>} A promise that resolves to an array of score objects.
 */
export async function getHighScores() {
    const response = await fetch(`${SCRIPT_URL}?action=getHighScores`);
    if (!response.ok) {
        throw new Error(`Failed to fetch high scores: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Submits a player's score to the server.
 * @param {string} playerName The name of the player.
 * @param {number} score The player's final score.
 */
export async function submitScore(playerName, score) {
    await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // 'no-cors' is often simplest for Apps Script to avoid preflight issues.
        headers: {
            'Content-Type': 'text/plain;charset=utf-8', // Use text/plain to avoid CORS preflight
        },
        body: JSON.stringify({
            action: 'submitScore',
            payload: { name: playerName, score: score }
        })
    });
}

/**
 * Requests a new game session from the server.
 * @param {string} mapId The ID of the map to play.
 * @returns {Promise<{sessionId: string, seed: string, mapTemplate: Object}>}
 */
export async function startNewGame(mapId) {
    const response = await fetch(`${SCRIPT_URL}?action=newGame&mapId=${mapId}`);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to start new game: ${errorData.message || response.statusText}`);
    }
    return response.json();
}

/**
 * Fetches the dynamic game configuration from the server.
 * @returns {Promise<Object>} A promise that resolves to the game config object.
 */
export async function getGameConfig() {
    const response = await fetch(`${SCRIPT_URL}?action=getGameConfig`);
    if (!response.ok) {
        throw new Error(`Failed to fetch game config: ${response.statusText}`);
    }
    return response.json();
}