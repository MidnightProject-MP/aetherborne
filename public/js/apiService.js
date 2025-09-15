/**
 * @file apiService.js
 * @description Centralized service for all communication with the Google Apps Script backend.
 */

// IMPORTANT: Replace this with your actual Web App URL from the Apps Script editor deployment.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw-yI5b9gLq0RMKy9-eKiktBbrUBzizi1CZg0-vBhzwsRhmKrEr9xIXZ1T3H19daaXLEQ/exec";

/**
 * A centralized function to handle all POST requests to the Apps Script backend.
 * It includes the essential `redirect: 'follow'` option.
 * @param {string} action The action to be performed by the backend.
 * @param {Object} payload The data associated with the action.
 * @returns {Promise<Object>} A promise that resolves to the JSON response from the server.
 */
async function postToServer(action, payload = {}) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow', // Crucial for handling Google Script's 302 redirects on POST.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload })
    });

    if (!response.ok) {
        let errorMessage = response.statusText;
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch (e) {
            // Response was not JSON, stick with the status text.
        }
        throw new Error(`API Error for action '${action}': ${errorMessage}`);
    }

    return response.json();
}

// --- Exported API Functions ---

export async function getHighScores() { return postToServer('getHighScores'); }

export async function submitScore(playerName, score) { return postToServer('submitScore', { name: playerName, score }); }

export async function startNewGame(mapId, characterData) { return postToServer('newGame', { mapId, characterData }); }

export async function submitReplay(sessionId, replayLog, finalStateClient, playerName) { return postToServer('submitReplay', { sessionId, replayLog, finalStateClient, playerName }); }

export async function getGameConfig() { return postToServer('getGameConfig'); }

export async function getReplay(sessionId) { return postToServer('getReplay', { sessionId }); }

export async function getPlayerData(playerId) { return postToServer('getPlayerData', { playerId }); }

export async function updatePlayerState(playerId, finalState) { return postToServer('updatePlayerState', { playerId, finalState }); }