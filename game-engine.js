/**
 * @fileoverview This file contains the server-side logic for the game.
 * It contains a simplified game engine for replay validation and all backend API handlers.
 */

const SCRIPT_VERSION = "1.1.0"; // Increment this with significant backend changes.

/**
 * Generates a UUID-like string using a provided seeded pseudo-random number generator.
 * This is the server-side equivalent of the client's function in utils.js.
 * @param {function(): number} rng - The seeded PRNG function.
 * @returns {string} A new deterministically generated UUID.
 */
function generateDeterministicUUID(rng) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (rng() % 16) | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
/**
 * A server-side helper to create a plain JavaScript object representing an entity.
 * It uses the game configuration to build an entity from a blueprint, similar to the client's EntityFactory.
 * @param {string} type - The type of entity (e.g., 'player', 'goblinScout').
 * @param {object} properties - Properties from the map file or character data.
 * @param {object} gameConfig - The full game configuration object.
 * @returns {object|null} A plain object representing the entity, or null.
 */
function createServerEntity(type, properties, gameConfig, rng) {
    const blueprintType = gameConfig.entityBlueprints[type] ? type : 'enemy';
    const blueprint = gameConfig.entityBlueprints[blueprintType];
    if (!blueprint) return null;

    const entity = {
        // Use the deterministic UUID generator if an ID isn't provided in the properties.
        id: properties.id || (rng ? generateDeterministicUUID(rng) : ('server-gen-' + Math.random())),
        type: type,
        name: properties.name || type,
        q: properties.q,
        r: properties.r,
        ...blueprint.entityProperties,
        ...properties
    };

    // Extract stats from the blueprint and properties
    const statsConfig = blueprint.components.find(c => c.class === 'StatsComponent');
    if (statsConfig) {
        let statsArgs = {};
        if (statsConfig.argsSource === 'entityProperties' && statsConfig.dataSourceKey) {
            statsArgs = properties[statsConfig.dataSourceKey] || {};
        } else if (statsConfig.argsSource === 'archetypeBaseStats') {
            statsArgs = properties.baseStats || {};
        } else {
            statsArgs = statsConfig.args || {};
        }
        entity.stats = { ...statsArgs };
    } else {
        entity.stats = {};
    }

    // Ensure player has XP property
    if (type === 'player') {
        entity.stats.xp = 0;
    }

    return entity;
}


/**
 * A stateful, server-side game engine for validating replays.
 * It's a simplified version of the client's engine but understands entities,
 * interactions, and map transitions.
 */
class GameEngine {
    constructor(seed, mapTemplate, characterData, gameConfig) {
        this.seed = seed;
        this.mapTemplate = mapTemplate;
        this.gameConfig = gameConfig;
        this.rng = this.createSeededRNG(this.seed);
        this.gameState = {
            player: null,
            entities: new Map() // Use a map for quick lookups by ID
        };
        this.initializeGameState(characterData);
    }

    createSeededRNG(seed) {
        if (!seed) seed = "default_seed";
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

    initializeGameState(characterData) {
        // Create player
        const player = createServerEntity('player', characterData, this.gameConfig, this.rng);
        this.gameState.player = player;
        this.gameState.entities.set(player.id, player);

        // Initialize entities for the first map
        this.initializeEntitiesForNewMap();
    }

    initializeEntitiesForNewMap() {
        // Place player at new start position
        const playerStart = this.mapTemplate.playerStart;
        if (playerStart) {
            this.gameState.player.q = playerStart.q;
            this.gameState.player.r = playerStart.r;
        }

        // Create other entities from map config
        if (!this.mapTemplate.entities) return;
        for (const category in this.mapTemplate.entities) {
            for (const entityConfig of this.mapTemplate.entities[category]) {
                const entity = createServerEntity(entityConfig.type, entityConfig, this.gameConfig, this.rng);
                if (entity) {
                    this.gameState.entities.set(entity.id, entity);
                }
            }
        }
    }

    executeMove(targetCoords) {
        const player = this.gameState.player;
        if (player) {
            player.q = targetCoords.q;
            player.r = targetCoords.r;
        }
        // After any move, check if the player landed on a tile that triggers an interaction.
        this.checkAutoInteractions(targetCoords);
    }

    executePlayerInput(targetCoords) {
        // Find if there's an entity at the target coordinates.
        let targetEntity = null;
        for (const entity of this.gameState.entities.values()) {
            if (entity.q === targetCoords.q && entity.r === targetCoords.r && entity.id !== this.gameState.player.id) {
                targetEntity = entity;
                break;
            }
        }

        // If the target is an attackable enemy, it's a direct interaction (attack).
        // Otherwise (empty tile or non-attackable entity like a portal), it's a move.
        // The move itself will trigger any automatic interactions (like portals).
        if (targetEntity && targetEntity.stats && targetEntity.stats.hp > 0) {
            this.executeInteraction(targetEntity.id);
        } else {
            this.executeMove(targetCoords);
        }
    }

    checkAutoInteractions(coords) {
        // Find entities at the new coordinates, other than the player.
        for (const entity of this.gameState.entities.values()) {
            if (entity.id === this.gameState.player.id) continue;

            if (entity.q === coords.q && entity.r === coords.r) {
                // If we find a portal, interact with it.
                if (entity.type === 'portal') {
                    this.executeInteraction(entity.id);
                    // Important: break because a portal transition changes the entity list,
                    // which would invalidate the iterator for this loop.
                    break;
                }
                // Future logic for traps could be added here.
            }
        }
    }

    executeInteraction(targetId) {
        const player = this.gameState.player;
        const target = this.gameState.entities.get(targetId);

        if (!target) {
            console.log(`[GameEngine] Could not find target entity with ID ${targetId}. It might be on a subsequent map.`);
            return;
        }

        // If it's an enemy, attack it
        if (target.stats && target.stats.hp > 0) {
            target.stats.hp -= player.stats.attackPower || 10;
            if (target.stats.hp <= 0) {
                player.stats.xp += target.stats.xp || 10;
                this.gameState.entities.delete(target.id);
                console.log(`[GameEngine] Player defeated ${target.name} and gained ${target.stats.xp || 10} XP. Total XP: ${player.stats.xp}`);
            }
            return;
        }

        // If it's a portal, handle map transition
        if (target.type === 'portal') {
            const nextMapId = target.nextMapId;
            if (nextMapId) {
                console.log(`[GameEngine] Player interacted with portal ${target.name}. Transitioning to map ${nextMapId}.`);
                const newMapTemplate = this.gameConfig.maps[nextMapId]?.maptemplate;

                if (!newMapTemplate) {
                    console.log(`[GameEngine] ERROR - Could not find map template for ${nextMapId}. Halting transition.`);
                    return;
                }

                this.mapTemplate = newMapTemplate;
                const playerEntity = this.gameState.entities.get(this.gameState.player.id);
                this.gameState.entities.clear();
                this.gameState.entities.set(playerEntity.id, playerEntity);
                this.initializeEntitiesForNewMap();

            } else {
                console.log(`[GameEngine] Player interacted with final portal. Dungeon complete.`);
            }
        }
    }

    executeSkill(details) {
        // Find if there's an entity at the target coordinates.
        // Note: This is a simplified lookup. A real implementation might need a spatial hash.
        let targetEntity = null;
        for (const entity of this.gameState.entities.values()) {
            if (entity.q === targetCoords.q && entity.r === targetCoords.r && entity.id !== this.gameState.player.id) {
                targetEntity = entity;
                break;
            }
        }

        const { skillId, targetCoords } = details;
        const player = this.gameState.player;
        const skillConfig = this.gameConfig.skills[skillId];

        if (!skillConfig) {
            console.log(`[GameEngine] Player tried to use unknown skill: ${skillId}`);
            return;
        }

        // This is a very simplified simulation. A real one would check AP, MP, cooldowns, etc.
        console.log(`[GameEngine] Player uses skill: ${skillConfig.name}`);

        for (const effect of skillConfig.effects) {
            switch (effect.type) {
                case 'damage':
                    // Simplified: find all entities in an area and apply damage.
                    const radius = effect.splashRadius || 0;
                    for (const entity of this.gameState.entities.values()) {
                        if (entity.id === player.id) continue;
                        
                        // Axial distance calculation
                        const dist = (Math.abs(targetCoords.q - entity.q) 
                                  + Math.abs(targetCoords.q + targetCoords.r - (entity.q + entity.r)) 
                                  + Math.abs(targetCoords.r - entity.r)) / 2;

                        if (dist <= radius) {
                            const damage = effect.baseAmount || 10;
                            if (entity.stats && entity.stats.hp > 0) {
                                entity.stats.hp -= damage;
                                console.log(`[GameEngine] Skill hits ${entity.name} for ${damage} damage.`);
                                if (entity.stats.hp <= 0) {
                                    player.stats.xp += entity.stats.xp || 10;
                                    this.gameState.entities.delete(entity.id);
                                    console.log(`[GameEngine] Player defeated ${entity.name} with a skill.`);
                                }
                            }
                        }
                    }
                    break;
                case 'movement':
                    if (effect.moveType === 'teleport') this.executeMove(targetCoords);
                    break;
            }
        }
    }

    playGame(replay) {
        for (const action of replay) {
            // Only process actions from the player this engine is tracking
            if (action.sourceId !== this.gameState.player.id) continue;

            if (action.type === 'move' && action.details && action.details.targetCoords) {
                this.executeMove(action.details.targetCoords);
            } else if (action.type === 'interactWithEntity' && action.details && action.details.targetId) {
                this.executeInteraction(action.details.targetId);
            } else if (action.type === 'playerInput' && action.details && action.details.targetCoords) {
                this.executePlayerInput(action.details.targetCoords);
            } else if (action.type === 'skill' && action.details && action.details.skillId) {
                this.executeSkill(action.details);
            }
        }
        // Return a simplified final state for score calculation
        return {
            player: {
                xp: this.gameState.player.stats.xp || 0
            }
        };
    }
}

// --- NEW: SCRIPT-LEVEL CONSTANTS & SETUP ---
// This pattern is more robust for standalone scripts and improves performance
// by opening the spreadsheet only once.
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// IMPORTANT: You must set this property in your Apps Script project settings.
// Go to Project Settings > Script Properties and add a property named 'SHEET_ID'
// with the ID of your Google Sheet.
const SHEET_ID = SCRIPT_PROPERTIES.getProperty('SHEET_ID');
const SPREADSHEET = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : null;

// --- APPS SCRIPT DATABASE & LOGGING FUNCTIONS ---
function getSheet(sheetName) {
  if (!SPREADSHEET) {
    throw new Error("Spreadsheet could not be opened. Ensure the 'SHEET_ID' script property is set correctly in Project Settings > Script Properties.");
  }
  return SPREADSHEET.getSheetByName(sheetName);
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
function logPlayerReplay(sheetName, sessionId, replayLog, finalState, isVerified) {
  const sheet = getSheet(sheetName);
  if (sheet) {
    const verificationStatus = isVerified ? 'VERIFIED' : 'MISMATCH';
    sheet.appendRow([sessionId, JSON.stringify(replayLog), JSON.stringify(finalState), new Date(), verificationStatus]);
  }
}

/**
 * Fetches and returns the top 10 high scores from the 'HighScores' sheet.
 */
function handleGetHighScores() {
  console.log('Action: handleGetHighScores');
  const sheet = getSheet('HighScores');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  // Sheet structure is: sessionId, playerName, score, timestamp
  const scores = data.slice(1) // Skip header
    .map(row => ({ 
        sessionId: row[0], 
        name: row[1], 
        score: parseInt(row[2], 10) 
    }))
    .filter(item => item.sessionId && item.name && !isNaN(item.score)) // Ensure all parts are valid
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
                    // Smart default: if the header implies a list/array, default to an empty array.
                    const lowerHeader = header.toLowerCase();
                    const isArrayLike = lowerHeader.includes("skills") || lowerHeader.includes("traits") || lowerHeader.includes("components");
                    value = isArrayLike ? [] : {};
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
    console.log('Action: handleGetGameConfig');
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

    // --- NEW: Manually define entity blueprints on the server ---
    // This should eventually be moved to its own sheet, but for now,
    // this mirrors the client-side config and fixes the crash.
    const entityBlueprints = {
        player: {
            entityProperties: { blocksMovement: true },
            components: [
                { class: 'StatsComponent', argsSource: 'archetypeBaseStats' },
                // Other components can be added here if needed for server validation
            ]
        },
        enemy: {
            entityProperties: { blocksMovement: true },
            components: [
                { class: 'StatsComponent', argsSource: 'entityProperties', dataSourceKey: 'stats' }
            ]
        }
        // Note: Specific enemies like 'goblinScout' will fall back to the 'enemy' blueprint
        // in createServerEntity, which is sufficient for current validation logic.
    };

    const gameConfig = {
        archetypes,
        skills,
        traits,
        statusEffects,
        maps,
        players,
        entityBlueprints // Add the blueprints to the config
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
    console.log(`Action: handleGetPlayerData, Payload: ${JSON.stringify(payload)}`);
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

    // --- NEW: Prioritize saved stats over archetype defaults ---
    // If the player has a saved stats object, use it. Otherwise, fall back to the archetype's base stats.
    // The 'stats' property is created by sheetToObjects from a 'Stats_JSON' column.
    if (playerData.stats && Object.keys(playerData.stats).length > 0) {
        console.log(`DEBUG: Loading player from saved stats for player '${playerId}'.`);
        finalCharacterData.baseStats = playerData.stats;
    } else {
        console.log(`DEBUG: Initializing player from archetype stats for player '${playerId}'.`);
        finalCharacterData.baseStats = archetype.basestats || {}; // Use normalized key
    }
    finalCharacterData.skills = Array.isArray(archetype.skills) ? [...archetype.skills] : [];

    // Hydrate trait IDs into full trait objects to match CharacterCreator's output format.
    // This makes the server's data packet complete and consistent.
    if (Array.isArray(playerData.traits)) {
        finalCharacterData.traits = playerData.traits.map(traitId => {
            const traitData = gameConfig.traits[traitId];
            // Return the full object, including its ID, which is the key in the config.
            return traitData ? { id: traitId, ...traitData } : null;
        }).filter(Boolean); // Filter out any nulls if a trait ID was invalid.
    } else {
        finalCharacterData.traits = [];
    }
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
  // All API actions are handled via doPost to allow for CORS headers.
  // This function serves as a simple health check when visiting the URL in a browser.
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'API is running. Use POST for actions.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles a request to fetch a specific replay by its session ID.
 * @param {Object} e The event parameter from doGet.
 * @returns {Object} The full replay data object.
 */
function handleGetReplay(payload) {
    console.log(`Action: handleGetReplay, Payload: ${JSON.stringify(payload)}`);
    const sessionId = payload.sessionId;
    if (!sessionId) throw new Error("Parameter 'sessionId' is required for action 'getReplay'.");

    // --- Step 1: Find the replay log in PlayerReplays ---
    const replaySheet = getSheet('PlayerReplays');
    if (!replaySheet) throw new Error("Sheet 'PlayerReplays' not found.");
    const replayValues = replaySheet.getDataRange().getValues();
    let replayLog = null;
    for (let i = replayValues.length - 1; i >= 0; i--) {
        if (replayValues[i][0] === sessionId) {
            // New structure: [sessionId, replayLog_JSON, finalState_JSON, timestamp, status]
            replayLog = JSON.parse(replayValues[i][1]);
            break;
        }
    }
    if (!replayLog) throw new Error(`Replay log for sessionId '${sessionId}' not found in PlayerReplays.`);

    // --- Step 2: Find the session start data in GameSessions ---
    const sessionsSheet = getSheet('GameSessions');
    if (!sessionsSheet) throw new Error("Sheet 'GameSessions' not found.");
    const sessionsValues = sessionsSheet.getDataRange().getValues();
    console.log(`Searching for session '${sessionId}' in ${sessionsValues.length} rows.`);
    let seed = null;
    let versionedMapId = null;
    let initialCharacterData = null; // Declare the variable to hold the parsed data.
    for (let i = sessionsValues.length - 1; i >= 0; i--) {
        if (sessionsValues[i][0] === sessionId) {
            // Structure: [sessionId, seed, versionedMapId, timestamp, status, characterData_JSON]
            seed = sessionsValues[i][1];
            versionedMapId = sessionsValues[i][2];
            const initialCharacterDataString = sessionsValues[i][5];
            if (initialCharacterDataString) {
                console.log(`Found character data string for session '${sessionId}'.`);
                initialCharacterData = JSON.parse(initialCharacterDataString);
            } else {
                console.log(`Session '${sessionId}' found, but its character data string is empty.`);
            }
            break;
        }
    }
    if (!seed || !versionedMapId || !initialCharacterData) {
        // This detailed log helps distinguish between a missing session and incomplete data.
        console.error(`Incomplete session data for '${sessionId}': seed=${seed}, mapId=${versionedMapId}, charDataExists=${!!initialCharacterData}`);
        throw new Error(`Initial session data (including character) for sessionId '${sessionId}' not found in GameSessions.`);
    }

    // --- Step 3: Get the map template from the game config ---
    const gameConfig = handleGetGameConfig();
    const mapData = gameConfig.maps[versionedMapId];
    if (!mapData) {
        throw new Error(`Could not find map template for versioned ID '${versionedMapId}' needed for replay '${sessionId}'.`);
    }
    const mapTemplate = mapData.maptemplate;

    // --- Step 4: Assemble and return the complete replay object ---
    return { sessionId, seed, mapTemplate, replayLog, initialCharacterData };
}

/**
 * Fetches and returns all players from the 'Players' sheet.
 */
function handleGetPlayers() {
    console.log('Action: handleGetPlayers');
    const sheet = getSheet('Players');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return []; // No data besides header

    const headers = data.shift(); // Get and remove header row

    const players = data.map(row => {
        if (!row[0]) return null; // Skip rows without a PlayerID
        let obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
        });
        return obj;
    }).filter(Boolean); // Remove nulls

    return players;
}

/**
 * Adds a new player to the 'Players' sheet.
 */
function handleAddPlayer(payload) {
    console.log(`Action: handleAddPlayer, Payload: ${JSON.stringify(payload)}`);
    const { playerId, name, archetypeId, currentMapId } = payload;
    if (!playerId || !name || !archetypeId || !currentMapId) {
        throw new Error("Payload for 'addPlayer' must include 'playerId', 'name', 'archetypeId', and 'currentMapId'.");
    }

    const sheet = getSheet('Players');
    if (!sheet) throw new Error("Critical Error: Sheet 'Players' not found.");

    const idColumnValues = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues();
    if (idColumnValues.flat().some(id => id === playerId)) {
        throw new Error(`Player with ID '${playerId}' already exists.`);
    }
    sheet.appendRow([playerId, name, archetypeId, currentMapId]);
    return { status: 'success', message: `Player '${name}' added successfully.` };
}
/**
 * Handles a test POST request.
 */
function handleTestPost() {
    console.log('Action: handleTestPost');
    return { status: 'success', message: 'hello world!' };
}

/**
 * Handles starting a new game session.
 */
function handleNewGame(payload) {
    console.log(`Action: handleNewGame, Payload: ${JSON.stringify(payload)}`);
    let { mapId, characterData } = payload;
    if (!mapId || !characterData) {
        throw new Error("Payload for 'newGame' must include 'mapId' and 'characterData'.");
    }

    if (characterData.playerid) {
        console.log(`New game request for existing player: ${characterData.playerid}. Fetching authoritative data.`);
        const authoritativeCharacterData = handleGetPlayerData({ playerId: characterData.playerid });
        characterData = authoritativeCharacterData;
        mapId = characterData.currentmapid;
    } else {
        // This is a new character. The server is authoritative for its ID.
        // We generate it here so it can be returned to the client and used in the replay log.
        // We can't use the deterministic UUID generator because we don't have the session seed yet.
        characterData.id = Utilities.getUuid();
    }

    // --- Direct map lookup ---
    // This looks for a map directly by its ID, as versioning is not yet implemented in the sheets.
    const gameConfig = handleGetGameConfig();
    const mapData = gameConfig.maps[mapId];

    if (!mapData) {
        throw new Error(`Map with ID '${mapId}' not found in game config.`);
    }

    const mapTemplate = mapData.maptemplate;
    const versionedMapId = mapId; // The ID used for the session is the mapId itself.

    const sessionId = Utilities.getUuid();
    const seed = new Date().getTime().toString();

    const sessionsSheet = getSheet('GameSessions');
    // Store the specific versionedMapId in the session for later validation.
    if (sessionsSheet) sessionsSheet.appendRow([sessionId, seed, versionedMapId, new Date(), 'STARTED', JSON.stringify(characterData)]);
    
    return { sessionId, seed, mapTemplate, characterData };
}

/**
 * Handles updating a player's persistent state.
 */
function handleUpdatePlayerState(payload) {
    console.log(`Action: handleUpdatePlayerState, Payload: ${JSON.stringify(payload)}`);
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

    // --- Enhanced Update Logic ---
    // This now updates multiple columns for the player: CurrentMapID and Stats_JSON.
    // We assume the sheet layout is: A:PlayerID, B:Name, C:ArchetypeID, D:CurrentMapID, E:Stats_JSON
    const playerSheetRow = playerRowIndex + 1; // Sheet rows are 1-based
    const statsToSave = finalState.player || null; // The client sends stats under the 'player' key

    if (!statsToSave) {
        throw new Error(`'finalState' payload for player '${playerId}' is missing the 'player' stats object.`);
    }

    // Prepare the values to be written to the sheet.
    const newMapId = finalState.currentMapId || data[playerRowIndex][3]; // Use existing if not provided
    const statsJson = JSON.stringify(statsToSave);

    // Update the CurrentMapID (column 4) and Stats_JSON (column 5) in a single operation.
    // This is more efficient than separate 'setValue' calls.
    const updateRange = playersSheet.getRange(playerSheetRow, 4, 1, 2); // (row, start_col, num_rows, num_cols)
    updateRange.setValues([[newMapId, statsJson]]);

    console.log(`DEBUG: Updated player '${playerId}' with MapID '${newMapId}' and stats: ${statsJson}`);

    return { status: 'success', message: `Player ${playerId} state updated.`};
}

/**
 * Handles submission of a player's game replay for validation.
 */
function handleSubmitReplay(payload) {
    console.log(`Action: handleSubmitReplay, Payload: ${JSON.stringify(payload)}`);
    const { sessionId, replayLog, playerName } = payload;
    if (!sessionId || !replayLog || !playerName) {
        throw new Error("Payload for 'submitReplay' must include 'sessionId', 'replayLog', and 'playerName'.");
    }

    const sessionsSheet = getSheet('GameSessions');
    if (!sessionsSheet) throw new Error("Critical Error: Sheet 'GameSessions' not found.");
    
    const sessionsData = sessionsSheet.getDataRange().getValues();
    // Find the session row and its index
    let sessionRow, sessionRowIndex = -1;
    for (let i = 0; i < sessionsData.length; i++) {
        if (sessionsData[i][0] === sessionId) {
            sessionRow = sessionsData[i];
            sessionRowIndex = i;
            break;
        }
    }

    if (!sessionRow) throw new Error(`Session with ID '${sessionId}' not found. Replay rejected.`);

    const seed = sessionRow[1];
    const versionedMapId = sessionRow[2]; // This is now the specific version ID, e.g., 'map_01_v2'
    const initialCharacterDataString = sessionRow[5]; // characterData JSON
    const initialCharacterData = JSON.parse(initialCharacterDataString);

    // Get the full game configuration, which is needed by the new engine.
    const gameConfig = handleGetGameConfig();

    // Get the specific version of the map template from the full config.
    const mapDataForReplay = gameConfig.maps[versionedMapId];
    if (!mapDataForReplay) {
        throw new Error(`Map template for versioned map ID '${versionedMapId}' not found in game config.`);
    }
    const mapTemplate = mapDataForReplay.maptemplate;

    // --- REPLAY VALIDATION ---
    // The server engine is now more stateful and can process the replay log.
    const serverGame = new GameEngine(seed, mapTemplate, initialCharacterData, gameConfig);
    const finalStateServer = serverGame.playGame(replayLog);

    // For now, validation is always considered successful.
    const isVerified = true;
    // Log only the essential replay data. Seed and map info will be looked up from GameSessions.
    logPlayerReplay('PlayerReplays', sessionId, replayLog, finalStateServer, isVerified);

    if (isVerified) {
        // 1. Update the session status to 'COMPLETED'
        if (sessionRowIndex !== -1) sessionsSheet.getRange(sessionRowIndex + 1, 5).setValue('COMPLETED');
        // 2. Submit the score to the HighScores sheet
        const score = finalStateServer.player.xp || 0;
        const highScoresSheet = getSheet('HighScores');
        if (highScoresSheet) highScoresSheet.appendRow([sessionId, playerName, score, new Date()]);
    }
    
    const message = isVerified ? 'Replay verified and score submitted.' : 'Replay verification failed.';
    return { status: 'success', message: message, verified: isVerified };
}

function doOptions(e) {
  return ContentService.createTextOutput()
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * A test function to debug the complete game loop: new game -> submit replay.
 * This can be run directly from the Apps Script editor.
 */
function testSubmitReplay() {
  try {
    Logger.log("--- Starting Replay Submission Test ---");

    // 1. Start a new game to get a valid session
    Logger.log("Step 1: Calling handleNewGame to create a session...");
    const newGamePayload = {
      mapId: 'prologue_map_1', // A known starting map
      characterData: {
        name: 'Replay Tester',
        archetypeId: 'warrior' // A known archetype
      }
    };
    const sessionData = handleNewGame(newGamePayload);
    Logger.log(`Session created successfully. SessionID: ${sessionData.sessionId}`);
    Logger.log(`Player ID: ${sessionData.characterData.id}`);

    // 2. Create a mock replay log
    // This log simulates the player moving and then interacting with something.
    // The server-side engine will process these actions.
    Logger.log("Step 2: Creating a mock replay log...");
    const playerId = sessionData.characterData.id;
    const replayLog = [
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 5, r: 8 } } },
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 6, r: 5 } } },
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 6, r: 2 } } },
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 5, r: 1 } } },
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 4, r: 9 } } },
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 4, r: 6 } } },
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 4, r: 3 } } },
      { type: "playerInput", sourceId: playerId, details: { targetCoords: { q: 5, r: 1 } } }
    ];
    Logger.log(`Replay log created with ${replayLog.length} actions.`);

    // 3. Construct the payload for handleSubmitReplay
    Logger.log("Step 3: Constructing payload for handleSubmitReplay...");
    const submitPayload = {
      sessionId: sessionData.sessionId,
      replayLog: replayLog,
      playerName: sessionData.characterData.name
    };

    // 4. Call the handler and log the result
    Logger.log("Step 4: Calling handleSubmitReplay...");
    const result = handleSubmitReplay(submitPayload);
    
    Logger.log("✅ SUCCESS: handleSubmitReplay returned:");
    Logger.log(JSON.stringify(result, null, 2));

  } catch (e) {
    Logger.log(`❌ ERROR in testSubmitReplay: ${e.toString()}`);
    Logger.log(`Stack Trace: ${e.stack}`);
  }
}

/**
 * @function doPost
 * @description Handles player-submitted replays for validation and storage.
 * @param {Object} e The event object from the POST request.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Wait up to 30 seconds.

  const requestBody = e.postData ? e.postData.contents : '{}';

  try {
    // Log the key elements of the request as requested.
    console.log(`--- API Request Received ---`);
    console.log(`Request Body: ${requestBody}`);

    const request = JSON.parse(requestBody);
    const action = request.action;
    const payload = request.payload || {};

    // Helper to create a standard JSON response
    const createJsonResponse = (data) => {
      return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    };

    // Action router
    switch (action) {
      case 'getHighScores':
        return createJsonResponse(handleGetHighScores());
      case 'getGameConfig':
        return createJsonResponse(handleGetGameConfig());
      case 'getPlayerData':
        return createJsonResponse(handleGetPlayerData(payload));
      case 'getReplay':
        return createJsonResponse(handleGetReplay(payload));
      case 'getPlayers':
        return createJsonResponse(handleGetPlayers());
      case 'addPlayer':
        return createJsonResponse(handleAddPlayer(payload));
      case 'testPost':
        return createJsonResponse(handleTestPost());
      case 'newGame':
        return createJsonResponse(handleNewGame(payload));
      case 'updatePlayerState':
        return createJsonResponse(handleUpdatePlayerState(payload));
      case 'submitReplay':
        return createJsonResponse(handleSubmitReplay(payload));
      case undefined:
      case null:
        // Default ping action if no action is specified
        return createJsonResponse({ 
          status: 'success', 
          message: 'Ping successful. API is listening for POST requests.',
          version: SCRIPT_VERSION 
        });
      default:
        throw new Error(`Unknown action: '${action}'.`);
    }
  } catch (error) {
    // Log the full stack trace for better debugging in Apps Script logs.
    console.error('doPost Error:', error.stack);
    // Also add a simpler log for quick diagnosis in the execution logs.
    console.log(`--- API Request ERROR ---`);
    console.log(`Failed on request: ${requestBody}`);
    console.log(`Error message: ${error.message}`);

    const errorPayload = {
      status: 'error',
      message: error.message || error.toString(), // Use .message for more specific errors
      errorType: error.name || 'UnknownError'
    };
    const errorOutput = ContentService.createTextOutput(JSON.stringify(errorPayload));
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    return errorOutput;
  } finally {
    lock.releaseLock();
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
 * A test function to debug the getReplay action with a specific session ID.
 * This can be run directly from the Apps Script editor.
 */
function testHandleGetReplay() {
  try {
    Logger.log("--- Starting GetReplay Test ---");

    // The specific sessionId to test.
    const sessionId = 'a6e8b8e5-a9ab-4e1e-9922-396558a619f4';

    // Call handleGetReplay with the hardcoded sessionId.
    Logger.log(`Calling handleGetReplay for sessionId: ${sessionId}...`);
    const getReplayPayload = { sessionId: sessionId };
    const replayData = handleGetReplay(getReplayPayload);

    Logger.log("✅ SUCCESS: handleGetReplay returned:");
    Logger.log(JSON.stringify(replayData, null, 2));
  } catch (e) {
    Logger.log(`❌ ERROR in testHandleGetReplay: ${e.toString()}`);
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
