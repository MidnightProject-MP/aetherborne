import { Tile } from './tile.js';

/**
 * Manages the game's grid, tiles, and the entities upon them.
 * This class acts as the data model for the game world's geography and state.
 * @class GameMap
 */
class GameMap {
    /**
     * @param {object} eventBus - The global event bus instance.
     * @param {Layout} layout - The layout object for hex-to-pixel conversions.
     */
    constructor(eventBus, layout) {
        if (!eventBus || !layout) {
            throw new Error("GameMap requires an EventBus and a Layout instance.");
        }
        this.eventBus = eventBus;
        this.layout = layout;
        this.tiles = [];
        // A generic map to hold all entities on the map, keyed by their ID.
        this.entities = new Map();
        this.player = null;
    }

    initializeFromConfig({ mapConfig, entities }) {
        this._createGrid(mapConfig.gridSize);
        this._applyTileProperties(mapConfig.entities);
        this._placeEntities(entities);
    }

    /**
     * Calculates the pixel bounding box of all non-null tiles on the map.
     * This is used to find the visual center of the map content.
     * @returns {{minX: number, maxX: number, minY: number, maxY: number}}
     */
    calculateBounds() {
        const allTiles = this.getAllTiles();
        if (allTiles.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (const tile of allTiles) {
            const corners = this.layout.polygonCorners(tile);
            for (const corner of corners) {
                minX = Math.min(minX, corner.x);
                maxX = Math.max(maxX, corner.x);
                minY = Math.min(minY, corner.y);
                maxY = Math.max(maxY, corner.y);
            }
        }
        return { minX, maxX, minY, maxY };
    }

    /**
     * Checks if there is an unobstructed line of sight between two hexes.
     * @param {Tile} startHex - The starting hex (e.g., player's position).
     * @param {Tile} endHex - The target hex to check visibility to.
     * @returns {boolean} True if the line of sight is clear, false otherwise.
     */
    hasLineOfSight(startHex, endHex) {
        if (!startHex || !endHex) return false;
        if (startHex.equals(endHex)) return true;

        const lineOfHexes = Tile.line(startHex, endHex);
        // Check all tiles on the line, except for the start and end tiles themselves.
        for (let i = 1; i < lineOfHexes.length - 1; i++) {
            const tile = this.getTile(lineOfHexes[i].q, lineOfHexes[i].r);
            if (tile && tile.isObstacle) return false; // Blocked by an obstacle
        }
        return true; // No obstacles found
    }

    // --- THIS IS THE NEW METHOD ---
    /**
     * Calculates all tiles visible from a starting hex within a given range.
     * In a full implementation, this would use a proper line-of-sight algorithm
     * (e.g., raycasting or shadowcasting) that accounts for obstacles.
     * For now, it returns all tiles within a simple radius.
     * @param {Tile} startHex - The tile to calculate visibility from.
     * @param {number} range - The sight range in hexes.
     * @returns {Tile[]} An array of visible Tile objects.
     */
    calculateVisibility(startHex, range) {
        // This is currently a placeholder. For true line of sight, you would
        // replace getTilesInRange with a more advanced algorithm here.
        return this.getTilesInRange(startHex, range);
    }

    getTilesInRange(centerTile, range) {
        const results = [];
        if (!centerTile) return results;

        for (let q_offset = -range; q_offset <= range; q_offset++) {
            for (let r_offset = Math.max(-range, -q_offset - range); r_offset <= Math.min(range, -q_offset + range); r_offset++) {
                const tile = this.getTile(centerTile.q + q_offset, centerTile.r + r_offset);
                if (tile) {
                    results.push(tile);
                }
            }
        }
        return results;
    }

    /**
     * Resets pathfinding metadata for all tiles.
     * Call this before each pathfinding operation.
     */
    resetPathfindingData() {
        if (!this.tiles) return;
        for (const tile of this.getAllTiles()) {
            tile.fScore = Infinity;
            tile.gScore = Infinity;
            tile.cameFrom = null;
            tile.closed = false;
        }
    }

    // --- Other Data Management Methods ---
    _createGrid(gridSize) {
        this.tiles = [];
        for (let q = 0; q < gridSize.x; q++) {
            this.tiles[q] = [];
            for (let r = 0; r < gridSize.y; r++) {
                if ((q + r >= 5 && q + r <= 17)) {
                    const tile = new Tile(q, r, -q - r);
                    this.tiles[q][r] = tile;
                } else {
                    this.tiles[q][r] = null;
                }
            }
        }
    }
    
    _applyTileProperties(entityData = {}) {
        for (const tile of this.getAllTiles()) {
            tile.isObstacle = false;
            tile.isPortal = false;
        }
        (entityData?.obstacles || []).forEach(obs => {
            const tile = this.getTile(obs.q, obs.r);
            if (tile) tile.isObstacle = true;
        });
        (entityData?.portals || []).forEach(portal => {
            const tile = this.getTile(portal.q, portal.r);
            if (tile) {
                tile.isPortal = true;
                // Note: The portal entity itself holds the destination logic.
            }
        });
    }

    _placeEntities(entities) {
        this.entities.clear();
        this.player = null;
        for (const entity of entities) {
            this.entities.set(entity.id, entity);
            // A more robust way to identify the player is by its component.
            if (entity.hasComponent('PlayerInputComponent')) {
                this.player = entity;
            }
        }
    }

    getTile(q, r) { return this.tiles[q]?.[r] || null; }
    getAllTiles() { return this.tiles.flat().filter(tile => tile !== null); }
    getEnemies() {
        // Enemies are entities that have AI-driven behavior.
        return [...this.entities.values()].filter(e => e.hasComponent('BehaviorComponent'));
    }
    getWalkableNeighbors(tile) {
        const neighbors = [];
        if (!tile) return neighbors;
        for (const dir of Tile.directions) {
            const neighborTile = this.getTile(tile.q + dir.q, tile.r + dir.r);
            if (neighborTile && !neighborTile.isObstacle && neighborTile.visibility !== 'hidden') {
                // Check if the neighbor tile is occupied by an entity that blocks movement
                const entitiesOnNeighbor = this.getEntitiesAt(neighborTile.q, neighborTile.r);
                const isBlockedByEntity = entitiesOnNeighbor.some(e => e.blocksMovement);
                if (!isBlockedByEntity) {
                    neighbors.push(neighborTile);
                }
            }
        }
        return neighbors;
    }
    /**
     * Returns a single entity at a given location, prioritizing non-blocking entities
     * or the player if multiple exist. This is useful for targeting.
     * For finding all entities (e.g., player on a trap), use getEntitiesAt.
     * @param {number} q - The q coordinate.
     * @param {number} r - The r coordinate.
     * @returns {Entity|null}
     */
    getEntityAt(q, r) { // This method is primarily for targeting/interaction
        const entitiesOnTile = this.getEntitiesAt(q, r);
        // Prioritize entities that block movement, then the player, then any other.
        // This ensures that if you click on a tile with an enemy, you target the enemy.
        return entitiesOnTile.find(e => e.blocksMovement) || entitiesOnTile.find(e => e === this.player) || entitiesOnTile[0] || null;
    }

    /**
     * Returns an array of all entities at a given location.
     * @param {number} q - The q coordinate.
     * @param {number} r - The r coordinate.
     * @returns {Entity[]} An array of entities on the tile, sorted by zIndex (higher on top).
     */
    getEntitiesAt(q, r) {
        const targetTile = this.getTile(q, r);
        if (!targetTile) return []; // Return empty array if tile doesn't exist

        return [...this.entities.values()]
            .filter(entity => entity.hex && entity.hex.equals(targetTile))
            .sort((a, b) => a.zIndex - b.zIndex); // Sort by zIndex for consistent layering
    }

    removeEntity(entity) {
        if (entity) {
            this.entities.delete(entity.id);
        }
    }

    /**
     * Returns an array of walkable neighbor tiles for the given tile.
     * @param {Tile} tile
     * @returns {Tile[]}
     */
    getNeighbors(tile) {
        // Hex directions: [q, r]
        const directions = [
            [1, 0], [1, -1], [0, -1],
            [-1, 0], [-1, 1], [0, 1]
        ];
        const neighbors = [];
        for (const [dq, dr] of directions) {
            const neighbor = this.getTile(tile.q + dq, tile.r + dr);
            if (neighbor && !neighbor.isObstacle) {
                neighbors.push(neighbor);
            }
        }
        return neighbors;
    }

    /**
     * Returns an array of all neighbor tiles for the given tile, regardless of walkability.
     * @param {Tile} tile
     * @returns {Tile[]}
     */
    getRawNeighbors(tile) {
        const directions = [
            [1, 0], [1, -1], [0, -1],
            [-1, 0], [-1, 1], [0, 1]
        ];
        const neighbors = [];
        for (const [dq, dr] of directions) {
            const neighbor = this.getTile(tile.q + dq, tile.r + dr);
            if (neighbor) { // Only check if tile exists, not if it's an obstacle
                neighbors.push(neighbor);
            }
        }
        return neighbors;
    }
}

export default GameMap;
