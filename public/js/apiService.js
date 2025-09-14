/**
 * @file apiService.js
 * @description Centralized service for all communication with the Google Apps Script backend.
 */

// IMPORTANT: Replace this with your actual Web App URL from the Apps Script editor deployment.
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzg9Z9BCNtRcduDE5ZXKlxboqixhPxs27pOC27dNCh4BJ-fVAVl3r5QDrjJ8MtCh13YtQ/exec";

/**
 * Fetches the top high scores from the server.
 * @returns {Promise<Array>} A promise that resolves to an array of score objects.
 */
export async function getHighScores() {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getHighScores', payload: {} })
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch high scores: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status === 'error') throw new Error(`Server error fetching high scores: ${data.message}`);
    return data;
}

/**
 * Submits a player's score to the server.
 * @param {string} playerName The name of the player.
 * @param {number} score The player's final score.
 */
export async function submitScore(playerName, score) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        // Using text/plain can often bypass complex CORS preflight checks.
        // The Apps Script backend can still parse the JSON string from the body.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'submitScore',
            payload: { name: playerName, score: score }
        })
    });
    if (!response.ok) {
        throw new Error(`Failed to submit score: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Requests a new game session from the server.
 * @param {string} mapId The ID of the map to play.
 * @param {Object} characterData The initial state of the character starting the game.
 * @returns {Promise<{sessionId: string, seed: string, mapTemplate: Object}>}
 */
export async function startNewGame(mapId, characterData) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'newGame',
            payload: { mapId, characterData }
        })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to start new game: ${errorData.message || response.statusText}`);
    }
    return response.json();
}

/**
 * Submits a full game replay for server-side validation.
 * @param {string} sessionId The unique ID of the game session.
 * @param {Array} replayLog An array of actions taken by the player.
 * @param {Object} finalStateClient The client's final state of the game.
 * @param {string} playerName The name of the player.
 * @returns {Promise<Object>} A promise that resolves to the server's validation response.
 */
export async function submitReplay(sessionId, replayLog, finalStateClient, playerName) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'submitReplay',
            payload: { sessionId, replayLog, finalStateClient, playerName }
        })
    });
    if (!response.ok) {
        throw new Error(`Failed to submit replay: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Fetches the dynamic game configuration from the server.
 * @returns {Promise<Object>} A promise that resolves to the game config object.
 */
export async function getGameConfig() {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getGameConfig', payload: {} })
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch game config: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status === 'error') throw new Error(`Server error fetching game config: ${data.message}`);
    return data;
}

/**
 * Fetches a specific game replay from the server.
 * @param {string} sessionId The unique ID of the game session to fetch.
 * @returns {Promise<Object>} A promise that resolves to the full replay data object.
 */
export async function getReplay(sessionId) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'getReplay',
            payload: { sessionId }
        })
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch replay for session ${sessionId}: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status === 'error') throw new Error(`Server error fetching replay: ${data.message}`);
    return data;
}

/**
 * Fetches data for a specific player character.
 * @param {string} playerId The ID of the player to fetch.
 * @returns {Promise<Object>} A promise that resolves to the character data object.
 */
export async function getPlayerData(playerId) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'getPlayerData',
            payload: { playerId }
        })
    });
    const data = await response.json();

    if (data.status === 'error') {
        throw new Error(`Server error fetching player data: ${data.message}`);
    }
    return data;
}

/**
 * Updates a player's persistent state on the server.
 * @param {string} playerId The ID of the player to update.
 * @param {Object} finalState The final state of the player character.
 * @returns {Promise<Object>}
 */
export async function updatePlayerState(playerId, finalState) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'updatePlayerState',
            payload: { playerId, finalState }
        })
    });
    if (!response.ok) {
        throw new Error(`Failed to update player state: ${response.statusText}`);
    }
    return response.json();
}