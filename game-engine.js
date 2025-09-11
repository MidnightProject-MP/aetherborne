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
  // Assumes headers: Name, Score, Timestamp. Skips header row [0].
  const scores = data.slice(1)
    .map(row => ({ name: row[0], score: parseInt(row[1], 10) }))
    .filter(item => !isNaN(item.score)) // Ensure score is a number
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  return scores;
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
  
  const headers = data.shift(); // Get and remove header row
  
  const result = {};

  data.forEach(row => {
    const id = row[0];
    if (!id) return; // Skip rows without an ID

    const entry = {};
    headers.forEach((header, index) => {
      if (index === 0) return; // Skip the ID column itself from being a property

      let value = row[index];
      // If a column header ends with _JSON, parse the value.
      if (header.endsWith('_JSON') && typeof value === 'string' && value.trim()) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          console.error(`Failed to parse JSON for ID '${id}' in column '${header}': ${value}`);
          value = {}; // Default to empty object on parse error
        }
      }
      // Convert header to camelCase key (e.g., "BaseStats_JSON" -> "baseStats")
      const key = header.replace(/_JSON$/, '');
      const camelCaseKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
      entry[camelCaseKey] = value;
    });
    result[id] = entry;
  });
  
  return result;
}

/**
 * Fetches all core game configuration data from their respective sheets.
 */
function handleGetGameConfig() {
    // NOTE: This assumes you have sheets named 'Archetypes', 'Skills', 'Traits', 'StatusEffects'
    const archetypes = sheetToObjects(getSheet('Archetypes'));
    const skills = sheetToObjects(getSheet('Skills'));
    const traits = sheetToObjects(getSheet('Traits'));
    const statusEffects = sheetToObjects(getSheet('StatusEffects'));
    
    // We only return the parts of the config that are stored in sheets.
    // The client will be responsible for merging this with the static parts of its config.
    return {
        archetypes,
        skills,
        traits,
        statusEffects
    };
}

/**
 * Handles a request to start a new game.
 * @param {Object} e The event parameter from doGet.
 * @returns {Object} A data object for the new session: { sessionId, seed, mapTemplate }.
 */
function handleNewGame(e) {
  const mapId = e.parameter.mapId;
  if (!mapId) {
    throw new Error("Parameter 'mapId' is required for action 'newGame'.");
  }

  const mapsSheet = getSheet('Maps');
  if (!mapsSheet) throw new Error("Critical Error: Sheet 'Maps' not found.");
  
  const mapsData = mapsSheet.getDataRange().getValues();
  const mapRow = mapsData.find(row => row[0] === mapId);
  if (!mapRow) throw new Error(`Map with ID '${mapId}' not found.`);
  
  const mapTemplate = JSON.parse(mapRow[2]); // Assumes template is in the 3rd column

  const sessionId = Utilities.getUuid();
  const seed = new Date().getTime().toString();

  const sessionsSheet = getSheet('GameSessions');
  if (sessionsSheet) {
    sessionsSheet.appendRow([sessionId, seed, mapId, new Date(), 'STARTED']);
  }
  return { sessionId, seed, mapTemplate };
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
  try {
    const action = e.parameter.action;
    let responseData;

    if (action === 'getHighScores') {
      responseData = handleGetHighScores();
    } else if (action === 'getGameConfig') {
      responseData = handleGetGameConfig();
    } else if (action === 'newGame') {
      responseData = handleNewGame(e);
    } else { // Default action is getting a replay for backward compatibility
      const sessionId = e.parameter.sessionId;
      if (!sessionId) throw new Error("Parameter 'action' or 'sessionId' is required.");
      
      const sheetsToSearch = ['AI_Agent_001', 'Player_Replays'];
      for (const sheetName of sheetsToSearch) {
        const sheet = getSheet(sheetName);
        if (!sheet) continue;
        const values = sheet.getDataRange().getValues();
        for (let i = values.length - 1; i >= 0; i--) {
          if (values[i][0] === sessionId) {
            responseData = { sessionId: values[i][0], seed: values[i][1], mapTemplate: JSON.parse(values[i][2]), replayLog: JSON.parse(values[i][3]) };
            break;
          }
        }
        if (responseData) break;
      }
      if (!responseData) throw new Error(`Replay with sessionId '${sessionId}' not found.`);
    }

    return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error('doGet Error:', error);
    const statusCode = error.message.includes("not found") ? 404 : 400;
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message })).setMimeType(ContentService.MimeType.JSON).setStatusCode(statusCode);
  }
}

/**
 * @constant POC_MAP_TEMPLATE
 * @description The map template used in the client PoC. This is needed for server-side validation.
 * In a real app, this would be fetched by the client at the start of a session, not hardcoded here.
 */
const POC_MAP_TEMPLATE = {
    width: 11,
    height: 13,
    tiles: [
        ['floor', 'floor', 'floor', 'wall', 'wall', 'wall', 'floor', 'floor', 'floor', 'wall', 'floor'],
        ['floor', 'wall', 'floor', 'floor', 'floor', 'floor', 'floor', 'wall', 'floor', 'wall', 'floor'],
        ['floor', 'wall', 'floor', 'wall', 'wall', 'wall', 'floor', 'wall', 'floor', 'wall', 'floor'],
        ['floor', 'floor', 'floor', 'wall', 'floor', 'floor', 'floor', 'wall', 'floor', 'wall', 'floor'],
        ['wall', 'wall', 'wall', 'wall', 'floor', 'wall', 'wall', 'wall', 'floor', 'wall', 'wall'],
        ['floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor'],
        ['floor', 'wall', 'wall', 'wall', 'floor', 'wall', 'floor', 'wall', 'wall', 'wall', 'floor'],
        ['floor', 'wall', 'floor', 'floor', 'floor', 'wall', 'floor', 'floor', 'floor', 'wall', 'floor'],
        ['floor', 'wall', 'floor', 'wall', 'floor', 'wall', 'wall', 'wall', 'floor', 'wall', 'floor'],
        ['floor', 'wall', 'floor', 'wall', 'floor', 'wall', 'floor', 'floor', 'floor', 'wall', 'floor'],
        ['floor', 'floor', 'floor', 'wall', 'floor', 'floor', 'floor', 'wall', 'floor', 'floor', 'floor'],
        ['wall', 'wall', 'floor', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
        ['floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor'],
    ]
};

/**
 * @function doPost
 * @description Handles player-submitted replays for validation and storage.
 * @param {Object} e The event object from the POST request.
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const { action, payload } = request;

    if (!action || !payload) {
      throw new Error("Request must include 'action' and 'payload' properties.");
    }

    if (action === 'submitScore') {
      const { name, score } = payload;
      if (!name || typeof score !== 'number') throw new Error("Payload for 'submitScore' must include 'name' (string) and 'score' (number).");
      
      const sheet = getSheet('HighScores');
      sheet.appendRow([name, score, new Date()]);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Score submitted.' })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === 'submitReplay') {
      const { session_id, replay_log, final_state_client } = payload;
      const playerReplaySheet = 'Player_Replays';
      const seed = session_id;
      const mapTemplate = POC_MAP_TEMPLATE; // In a real app, this should be part of the payload or fetched.

      const game = new GameEngine(seed, mapTemplate);
      const finalStateServer = game.playGame(replay_log);
      const isVerified = JSON.stringify(finalStateServer) === JSON.stringify(final_state_client);
      logPlayerReplay(playerReplaySheet, session_id, seed, mapTemplate, replay_log, finalStateServer, isVerified);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Replay received.' })).setMimeType(ContentService.MimeType.JSON);
    } else {
      throw new Error(`Unknown action: '${action}'.`);
    }
  } catch (error) {
    console.error('doPost Error:', error);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON).setStatusCode(400);
  }
}
