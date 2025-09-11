import { Tile } from '../tile.js';

/**
 * @class VisibilitySystem
 * Manages the Fog of War (FoW) state on the game map based on player's visibility.
 */
class VisibilitySystem {
    constructor(eventBus, game) {
        this.eventBus = eventBus;
        this.game = game;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Re-check visibility whenever the player moves or a new turn starts.
        this.eventBus.subscribe('moveCompleted', (payload) => {
            if (this.game.player && payload.entityId === this.game.player.id) {
                this.updateVisibility();
            }
        });
        this.eventBus.subscribe('turnStarted', (payload) => {
            if (payload.currentTurn === 'player') {
                this.updateVisibility();
            }
        });
    }

    /**
     * The main function to update the map's Fog of War state based on the player's position.
     */
    updateVisibility() {
        const player = this.game.player;
        if (!player || !player.hex) return;

        const visibilityComp = player.getComponent('visibility');
        if (!visibilityComp) return;

        const { sightRangeFull, sightRangePartial } = visibilityComp;
        const gameMap = this.game.gameMap;

        // 1. First, demote any currently 'full' visibility tiles to 'partial'.
        // This ensures that areas the player moves away from remain "explored".
        gameMap.getAllTiles().forEach(tile => {
            if (tile.visibility === 'full') {
                tile.visibility = 'partial';
            }
        });

        // 2. Calculate new visibility by checking LOS for each tile in range.
        const tilesInPartialRange = gameMap.getTilesInRange(player.hex, sightRangePartial);

        for (const tile of tilesInPartialRange) {
            // If a tile is in range, check if there's a clear line of sight to it.
            if (gameMap.hasLineOfSight(player.hex, tile)) {
                // If the line of sight is clear, all tiles along that line are revealed.
                // This prevents gaps where a distant tile is visible but an intermediate one is not.
                const line = Tile.line(player.hex, tile);
                for (const lineTile of line) {
                    const actualTile = gameMap.getTile(lineTile.q, lineTile.r);
                    if (actualTile) {
                        const distance = player.hex.distance(actualTile);
                        if (distance <= sightRangeFull) {
                            actualTile.visibility = 'full';
                        } else if (actualTile.visibility === 'hidden') {
                            actualTile.visibility = 'partial';
                        }
                    }
                }
            }
        }

        // 3. Finally, notify the renderer that the visibility data has changed.
        this.eventBus.publish('visibilityUpdated');
    }
}

export default VisibilitySystem;