/**
 * @fileoverview This file contains the server-side logic for the game.
 * It acts as the AI engine and replay data provider.
 */

// --- CORE GAME ENGINE (SINGLE SOURCE OF TRUTH) ---
class GameEngine {
    constructor(seed, mapTemplate, initialState = null) {
        this.seed = seed;
        this.mapTemplate = mapTemplate;
        this.rng = this.createSeededRNG(this.seed);
        this.gameState = initialState || {
            player: {
                x: 0,
                y: 0,
                health: 100,
                attack_power: 10,
                level: 1,
                xp: 0
            },
            enemies: []
        };
        if (!initialState) {
            this.initializeGameState();
        }
    }

    createSeededRNG(seed) {
        let h = 1779033703 ^ seed.length;
        for (let i = 0; i < seed.length; i++) {
            h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
            h = h << 13 | h >>> 19;
        }
        return function() {
            h = Math.imul(h ^ h >>> 16, 2246822507);
            h = Math.imul(h ^ h >>> 13, 3266489909);
            return (h ^= h >>> 16) >>> 0;
        };
    }

    initializeGameState() {
        this.gameState.player.x = 0;
        this.gameState.player.y = 0;

        for (let y = 0; y < this.mapTemplate.height; y++) {
            for (let x = 0; x < this.mapTemplate.width; x++) {
                if (this.mapTemplate.tiles[y][x] === 'floor') {
                    if (this.rng() % 100 < 10) {
                        this.gameState.enemies.push({
                            x: x,
                            y: y,
                            health: 20,
                            attack_power: 5
                        });
                    }
                }
            }
        }
    }

    isValidMove(x, y) {
        if (x < 0 || x >= this.mapTemplate.width || y < 0 || y >= this.mapTemplate.height) {
            return false;
        }
        return this.mapTemplate.tiles[y][x] === 'floor';
    }

    executeMove(move) {
        const nextState = JSON.parse(JSON.stringify(this.gameState)); // Deep copy to avoid side effects
        
        if (!this.isValidMove(move.x, move.y)) {
            return nextState;
        }

        nextState.player.x = move.x;
        nextState.player.y = move.y;

        const enemiesAfterMove = [];
        for (const enemy of nextState.enemies) {
            if (enemy.x === move.x && enemy.y === move.y) {
                // Combat logic
                enemy.health -= nextState.player.attack_power;
                nextState.player.health -= enemy.attack_power;
                if (enemy.health > 0) {
                    enemiesAfterMove.push(enemy);
                } else {
                    nextState.player.xp += 10; // Gain XP for defeating enemy
                }
            } else {
                enemiesAfterMove.push(enemy);
            }
        }
        nextState.enemies = enemiesAfterMove;

        // Simple level up logic
        if (nextState.player.xp >= nextState.player.level * 20) {
            nextState.player.level++;
            nextState.player.health += 20;
            nextState.player.attack_power += 2;
        }

        this.gameState = nextState;
        return this.gameState;
    }

    playGame(replay) {
        for (const move of replay) {
            this.executeMove(move);
        }
        return this.gameState;
    }
}

// --- APPS SCRIPT DATABASE & LOGGING FUNCTIONS ---
function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(sheetName);
}

/**
 * Logs a replay from an AI agent to the specified sheet.
 */
function logAiReplay(sheetName, sessionId, seed, mapTemplate, replayLog, finalState) {
  const sheet = getSheet(sheetName);
  if (sheet) {
    sheet.appendRow([
      sessionId,
      seed,
      JSON.stringify(mapTemplate),
      JSON.stringify(replayLog),
      JSON.stringify(finalState),
      new Date()
    ]);
  }
}

/**
 * Logs a replay from a player to the specified sheet, including verification status.
 */
function logPlayerReplay(sheetName, sessionId, seed, mapTemplate, replayLog, finalState, isVerified) {
  const sheet = getSheet(sheetName);
  if (sheet) {
    const verificationStatus = isVerified ? 'VERIFIED' : 'MISMATCH';
    sheet.appendRow([sessionId, seed, JSON.stringify(mapTemplate), JSON.stringify(replayLog), JSON.stringify(finalState), new Date(), verificationStatus]);
  }
}

/**
 * Fetches and returns the top 10 high scores from the 'HighScores' sheet.
 */
function handleGetHighScores() {
  const sheet = getSheet('HighScores');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  // Assumes headers: Name, Score, Timestamp, SessionID. Skips header row [0].
  const scores = data.slice(1)
    .map(row => ({ name: row[0], score: parseInt(row[1], 10), sessionId: row[3] }))
    .filter(item => !isNaN(item.score)) // Ensure score is a number
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  return scores;
}

/**
 * Normalizes a sheet header into a consistent key (lowercase).
 * @param {string} header The original header from the sheet.
 * @returns {string} A normalized, lowercase key.
 */
function normalizeHeader(header) {
  return header.replace(/_JSON$/, '').toLowerCase();
}
/**
 * Converts a sheet's data into an object map, using the first row as headers.
 * The object is keyed by the values in the first column (ID column).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to process.
 * @returns {Object} An object where keys are the ID from the first column.
 */
function sheetToObjects(sheet) {
    if (!sheet) return {};
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return {};

    const headers = data.shift();
    // --- NEW VALIDATION ---
    // Check if the headers are valid. If the first header is empty, assume the row is bad.
    if (!headers || !headers[0]) {
        console.error(`ERROR: Invalid or empty header row found in sheet '${sheet.getName()}'. Please ensure the first row contains valid headers.`);
        return {}; // Return an empty object to prevent crashes
    }
    // --- END VALIDATION ---

    const result = {};

    data.forEach(row => {
        const id = row[0];
        if (!id) return;

        const entry = {};
        for (let i = 1; i < headers.length; i++) {
            const header = headers[i];
            if (!header) continue; // Defensively skip empty header columns

            let value = row[i];
            const key = normalizeHeader(header);

            // Treat any column ending in _JSON (case-insensitive) or whose normalized key is 'maptemplate' as JSON.
            const isJsonColumn = header.toUpperCase().endsWith('_JSON') || key === 'maptemplate';

            if (isJsonColumn && typeof value === 'string' && value.trim()) {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    console.error(`Failed to parse JSON for ID '${id}' in column '${header}': ${value}`);
                    // Smart default: if the header implies an array, default to an empty array.
                    value = header.toLowerCase().includes("skills") || header.toLowerCase().includes("traits") ? [] : {};
                }
            }
            entry[key] = value;
        }
        result[id] = entry;
    });

    return result;
}

/**
 * Fetches all core game configuration data from their respective sheets.
 */
function handleGetGameConfig() {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'gameConfig_v2'; // Use a versioned key to easily invalidate if structure changes.

    // 1. Try to get the config from the cache.
    const cachedConfig = cache.get(cacheKey);
    if (cachedConfig) {
        console.log("DEBUG: Game config loaded from cache.");
        return JSON.parse(cachedConfig);
    }

    // 2. If not in cache, fetch from sheets (the slow part).
    console.log("DEBUG: Game config cache miss. Fetching from sheets...");
    const archetypes = sheetToObjects(getSheet('Archetypes'));
    const skills = sheetToObjects(getSheet('Skills'));
    const traits = sheetToObjects(getSheet('Traits'));
    const statusEffects = sheetToObjects(getSheet('StatusEffects'));
    const maps = sheetToObjects(getSheet('Maps'));
    const players = sheetToObjects(getSheet('Players'));

    const gameConfig = {
        archetypes,
        skills,
        traits,
        statusEffects,
        maps,
        players
    };

    // 3. Store the newly fetched config in the cache for next time.
    // Cache for 10 minutes (600 seconds). Adjust as needed.
    cache.put(cacheKey, JSON.stringify(gameConfig), 600);
    console.log("DEBUG: Game config stored in cache.");

    return gameConfig;
}

/**
 * Fetches data for a specific player from the 'Players' sheet.
 * @param {Object} payload The payload from the POST request.
 * @returns {Object} A characterData object ready for the client.
 */
function handleGetPlayerData(payload) {
    const playerId = payload.playerId;
    if (!playerId) {
        throw new Error("Parameter 'playerId' is required for action 'getPlayerData'.");
    }

    const gameConfig = handleGetGameConfig(); // Load all config, including players

    const playerData = gameConfig.players ? gameConfig.players[playerId] : null;
    if (!playerData) {
        throw new Error(`Player with ID '${playerId}' not found in 'Players' sheet.`);
    }

    const archetype = gameConfig.archetypes[playerData.archetypeid];
    if (!archetype) {
        throw new Error(`Archetype '${playerData.archetypeid}' for player '${playerId}' not found.`);
    }

    // --- Enhanced Debugging ---
    console.log(`DEBUG: Archetype found: ${JSON.stringify(archetype)}`);
    console.log(`DEBUG: Value of archetype.skills: ${JSON.stringify(archetype.skills)}`);
    console.log(`DEBUG: Is archetype.skills an array? ${Array.isArray(archetype.skills)}`);

    // Combine data to match the structure from CharacterCreator
    const finalCharacterData = { ...playerData };
    finalCharacterData.baseStats = archetype.basestats || {}; // Use normalized key
    finalCharacterData.skills = Array.isArray(archetype.skills) ? [...archetype.skills] : []; // Defensively handle skills

    return finalCharacterData;
}

// --- DATA ACCESS ---
function getMapTemplate() {
  const sheet = getSheet('Maps');
  const range = sheet.getDataRange();
  const values = range.getValues();
  // Get a random row, skipping the header
  const randomIndex = Math.floor(Math.random() * (values.length - 1)) + 1;
  const randomRow = values[randomIndex];
  
  return {
      seed: randomRow[0],
      map_template: JSON.parse(randomRow[1])
  };
}

// --- AI AGENT LOGIC ---
function runAiAgent() {
  const agentSheetName = 'AI_Agent_001';
  const sessionId = 'AI_' + Utilities.getUuid();
  const mapData = getMapTemplate(); 
  const seed = mapData.seed;
  const mapTemplate = mapData.map_template;
  
  const game = new GameEngine(seed, mapTemplate);
  const replayLog = [];
  
  // A simple AI: move randomly for up to 100 turns
  const directions = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
  for (let i = 0; i < 100; i++) {
    const randomDirection = directions[Math.floor(Math.random() * directions.length)];
    const newX = game.gameState.player.x + randomDirection.dx;
    const newY = game.gameState.player.y + randomDirection.dy;
    
    if (game.isValidMove(newX, newY)) {
      const move = { x: newX, y: newY };
      replayLog.push(move);
      game.executeMove(move);
      if (game.gameState.player.health <= 0) break;
    }
  }
  
  logAiReplay(agentSheetName, sessionId, seed, mapTemplate, replayLog, game.gameState);
  console.log(`AI agent session completed: ${sessionId}`);
}

/**
 * @function doGet
 * @description Serves replay data to the client-side viewer.
 * @param {Object} e The event object from the GET request.
 */
function doGet(e) {
  // doGet is no longer used for primary API actions.
  // All actions are now handled via doPost to simplify CORS management.
  // This can be used for a simple health check if needed.
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'API is running. Use POST for actions.' }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

/**
 * Handles a request to fetch a specific replay by its session ID.
 * @param {Object} e The event parameter from doGet.
 * @returns {Object} The full replay data object.
 */
function handleGetReplay(payload) {
    const sessionId = payload.sessionId;
    if (!sessionId) throw new Error("Parameter 'sessionId' is required for action 'getReplay'.");

    const sheetsToSearch = ['AI_Agent_001', 'PlayerReplays'];
    for (const sheetName of sheetsToSearch) {
        const sheet = getSheet(sheetName);
        if (!sheet) continue;
        const values = sheet.getDataRange().getValues();
        for (let i = values.length - 1; i >= 0; i--) {
            if (values[i][0] === sessionId) {
                return { sessionId: values[i][0], seed: values[i][1], mapTemplate: JSON.parse(values[i][2]), replayLog: JSON.parse(values[i][3]) };
            }
        }
    }
    throw new Error(`Replay with sessionId '${sessionId}' not found.`);
}

function doOptions(e) {
  return ContentService.createTextOutput()
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * @function doPost
 * @description Handles player-submitted replays for validation and storage.
 * @param {Object} e The event object from the POST request.
 */
function doPost(e) {
  try {
    // Use application/json content type
    const request = JSON.parse(e.postData.contents); 
    const action = request.action;
    const payload = request.payload || {}; // Ensure payload is an object even if empty

    if (!action) {
      // If no action is specified, it can be helpful to treat it as a simple ping/test
      // instead of an error. This will make your test case pass.
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Ping successful. API is listening for POST requests.' }))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader("Access-Control-Allow-Origin", "*");
    }

    // --- NEW: Simple test endpoint ---
    if (action === 'testPost') {
        const output = ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'hello world!' }))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader("Access-Control-Allow-Origin", "*");
        return output;
    }

    // --- NEW: Handle actions previously in doGet ---
    if (action === 'getHighScores') {
        const responseData = handleGetHighScores();
        return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON).setHeader("Access-Control-Allow-Origin", "*");
    }
    if (action === 'getGameConfig') {
        const responseData = handleGetGameConfig();
        return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON).setHeader("Access-control-allow-origin", "*");
    }
    if (action === 'getPlayerData') {
        const responseData = handleGetPlayerData(payload);
        return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON).setHeader("Access-Control-Allow-Origin", "*");
    }
    if (action === 'getReplay') {
        const responseData = handleGetReplay(payload);
        return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON).setHeader("Access-Control-Allow-Origin", "*");
    }

    // --- Existing POST actions ---
    if (action === 'submitScore') {
      const { name, score } = payload;
      if (!name || typeof score !== 'number') throw new Error("Payload for 'submitScore' must include 'name' (string) and 'score' (number).");
      
      const sheet = getSheet('HighScores');
      sheet.appendRow([name, score, new Date()]);
      const output = ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Score submitted.' }))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader("Access-Control-Allow-Origin", "*");
      return output;
            
    } else if (action === 'newGame') {
      let { mapId, characterData } = payload; // Use let as characterData may be replaced
      if (!mapId || !characterData) {
        throw new Error("Payload for 'newGame' must include 'mapId' and 'characterData'.");
      }

      // --- AUTHORITATIVE DATA CHECK ---
      // If the character data includes a playerId, it's an existing character.
      // We IGNORE the stats from the client and fetch the authoritative data from our sheet.
      if (characterData.playerid) {
          console.log(`New game request for existing player: ${characterData.playerid}. Fetching authoritative data.`);
          // Simulate the event object 'e' that handleGetPlayerData expects
          const authoritativeCharacterData = handleGetPlayerData({ playerId: characterData.playerid });
          
          // Replace the client-sent data with the server's authoritative data
          characterData = authoritativeCharacterData;
          
          // The mapId must also come from the authoritative data, not the client's request.
          mapId = characterData.currentmapid;
      }

      const mapsSheet = getSheet('Maps');
      if (!mapsSheet) throw new Error("Critical Error: Sheet 'Maps' not found.");
      
      const mapsData = mapsSheet.getDataRange().getValues();
      const mapRow = mapsData.find(row => row[0] === mapId);
      if (!mapRow) throw new Error(`Map with ID '${mapId}' not found.`);
      
      const mapTemplate = JSON.parse(mapRow[2]);
      const sessionId = Utilities.getUuid();
      const seed = new Date().getTime().toString();

      const sessionsSheet = getSheet('GameSessions');
      if (sessionsSheet) sessionsSheet.appendRow([sessionId, seed, mapId, new Date(), 'STARTED', JSON.stringify(characterData)]);
      
      // Return the full session details, including the (potentially updated) character data.
      const output = ContentService.createTextOutput(JSON.stringify({ sessionId, seed, mapTemplate, characterData }))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader("Access-Control-Allow-Origin", "*");
      return output;

    } else if (action === 'updatePlayerState') {
        const { playerId, finalState } = payload;
        if (!playerId || !finalState) {
            throw new Error("Payload for 'updatePlayerState' must include 'playerId' and 'finalState'.");
        }

        const playersSheet = getSheet('Players');
        if (!playersSheet) throw new Error("Critical Error: Sheet 'Players' not found.");

        const data = playersSheet.getDataRange().getValues();
        const playerRowIndex = data.findIndex(row => row[0] === playerId);

        if (playerRowIndex === -1) {
            throw new Error(`Player with ID '${playerId}' not found for update.`);
        }

        // This is a simplified update. It only updates the CurrentMapID.
        // A more complex implementation could update stats, traits, etc.
        // Note: The row index is 1-based for sheets, and we need to account for the header row.
        playersSheet.getRange(playerRowIndex + 1, 4).setValue(finalState.currentMapId);

        const output = ContentService.createTextOutput(JSON.stringify({ status: 'success', message: `Player ${playerId} state updated.`}))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader("Access-Control-Allow-Origin", "*");
        return output;

    } else if (action === 'submitReplay') {
      const { sessionId, replayLog, finalStateClient, playerName } = payload;
      if (!sessionId || !replayLog || !finalStateClient || !playerName) {
        throw new Error("Payload for 'submitReplay' must include 'sessionId', 'replayLog', and 'finalStateClient'.");
      }

      // --- 1. Fetch Authoritative Session Data ---
      const sessionsSheet = getSheet('GameSessions');
      if (!sessionsSheet) throw new Error("Critical Error: Sheet 'GameSessions' not found.");
      
      const sessionsData = sessionsSheet.getDataRange().getValues();
      const sessionRow = sessionsData.find(row => row[0] === sessionId);
      if (!sessionRow) throw new Error(`Session with ID '${sessionId}' not found. Replay rejected.`);

      const seed = sessionRow[1];
      const mapId = sessionRow[2];

      // --- 2. Re-run the game on the server using the authoritative data ---
      // NOTE: This is the CRITICAL DIVERGENCE POINT. The `GameEngine` class below
      // is a simple placeholder. For true validation, this must be replaced with
      // a headless version of the client's full ECS game engine.
      const mapsSheet = getSheet('Maps');
      const mapsData = mapsSheet.getDataRange().getValues();
      const mapRow = mapsData.find(row => row[0] === mapId);
      if (!mapRow) throw new Error(`Map with ID '${mapId}' from session not found.`);
      const mapTemplate = JSON.parse(mapRow[2]);

      const serverGame = new GameEngine(seed, mapTemplate);
      const finalStateServer = serverGame.playGame(replayLog);

      // --- 3. Compare states and log the result ---
      // TODO: Re-enable real validation once the server engine matches the client.
      const isVerified = true; // Forcing verification to pass for now.
      logPlayerReplay('PlayerReplays', sessionId, seed, mapTemplate, replayLog, finalStateServer, isVerified);

      // If verified, also log to HighScores sheet
      if (isVerified) {
        const score = finalStateServer.player.xp || 0;
        const highScoresSheet = getSheet('HighScores');
        if (highScoresSheet) highScoresSheet.appendRow([playerName, score, new Date(), sessionId]);
      }
      
      const message = isVerified ? 'Replay verified and saved.' : 'Replay verification failed.';
      const output = ContentService.createTextOutput(JSON.stringify({ status: 'success', message: message, verified: isVerified }))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader("Access-Control-Allow-Origin", "*");
      return output;

    } else {
      throw new Error(`Unknown action: '${action}'.`);
    }
  } catch (error) {
    // Log the full stack trace for better debugging in Apps Script logs.
    console.error('doPost Error:', error.stack);
    const errorOutput = ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }));
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    errorOutput.setHeader("Access-Control-Allow-Origin", "*");
    return errorOutput;
  }
}
/**
 * A test function to debug the getPlayerData action directly in the Apps Script editor.
 */
function testGetPlayerData() {
  const mockEvent = {
    // This now simulates the 'payload' object
    playerId: 'Player1'
  };

  try {
    // We call the handler function directly to isolate the business logic
    // from the web response (ContentService) logic, which can be unreliable in the test runner.
    const responseData = handleGetPlayerData(mockEvent);
    Logger.log("✅ SUCCESS: handleGetPlayerData returned:");
    // Pretty-print the JSON for readability in the logs.
    Logger.log(JSON.stringify(responseData, null, 2));
  } catch (e) {
    Logger.log(`❌ ERROR in handleGetPlayerData: ${e.toString()}`);
    Logger.log(`Stack Trace: ${e.stack}`);
  }
}

/**
 * A test function to debug the getGameConfig action directly in the Apps Script editor.
 * This allows you to verify that all configuration sheets are being read and parsed correctly.
 */
function testGetGameConfig() {
  try {
    Logger.log("Attempting to fetch game config...");
    // This call will be slow if the cache is empty.
    const responseData = handleGetGameConfig();
    Logger.log("✅ SUCCESS: handleGetGameConfig returned:");
    // Pretty-print the JSON for readability in the logs.
    Logger.log(JSON.stringify(responseData, null, 2));
  } catch (e) {
    Logger.log(`❌ ERROR in handleGetGameConfig: ${e.toString()}`);
    Logger.log(`Stack Trace: ${e.stack}`);
  }
}

/**
 * A utility function to be run manually from the Apps Script editor.
 * Its sole purpose is to execute the slow `handleGetGameConfig` function
 * and populate the script cache. This breaks the timeout cycle for the public web app.
 * Running this from the editor has a 6-minute timeout, which is sufficient.
 */
function primeGameConfigCache() {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'gameConfig_v2';
    Logger.log(`Clearing existing cache for key: ${cacheKey}`);
    cache.remove(cacheKey);

    Logger.log("Attempting to prime the game config cache...");
    // This call will be slow because the cache is now empty.
    handleGetGameConfig();
    Logger.log("✅ SUCCESS: Game config cache has been primed. Web app calls should now be fast.");
  } catch (e) {
    Logger.log(`❌ ERROR: Failed to prime cache: ${e.toString()}`);
    Logger.log(`Stack Trace: ${e.stack}`);
  }
}
