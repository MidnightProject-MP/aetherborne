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

function logReplay(sheetName, sessionId, seed, mapTemplate, replayLog, finalState) {
  const sheet = getSheet(sheetName);
  const data = [
    sessionId,
    seed,
    JSON.stringify(mapTemplate),
    JSON.stringify(replayLog),
    JSON.stringify(finalState),
    new Date()
  ];
  sheet.appendRow(data);
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
  
  logReplay(agentSheetName, sessionId, seed, mapTemplate, replayLog, game.gameState);
  console.log(`AI agent session completed: ${sessionId}`);
}

/**
 * @function doGet
 * @description Serves replay data to the client-side viewer.
 * @param {Object} e The event object from the GET request.
 */
function doGet(e) {
  const sessionId = e.parameter.sessionId;
  const sheet = getSheet('AI_Agent_001');
  const values = sheet.getDataRange().getValues();

  for (const row of values) {
    if (row[0] === sessionId) {
      const replayData = {
        sessionId: row[0],
        seed: row[1],
        mapTemplate: JSON.parse(row[2]),
        replayLog: JSON.parse(row[3])
      };
      return ContentService.createTextOutput(JSON.stringify(replayData))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Replay not found' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// TODO: Create a doPost function for player replay validation.
