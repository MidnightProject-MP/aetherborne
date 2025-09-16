/**
 * Renders temporary visualizations for potential player actions before they are committed.
 * This system listens for preview events and uses the SVGRenderer to draw on the map.
 * @class TargetPreviewSystem
 */
class TargetPreviewSystem {
    /**
     * @param {object} eventBus - The global event bus instance.
     * @param {object} game - A reference to the main game instance.
     * @param {string} interactionModel - The interaction model ('desktop' or 'mobile').
     */
    constructor(eventBus, game, interactionModel = 'desktop') {
        if (!eventBus || !game) {
            throw new Error("TargetPreviewSystem requires an EventBus and a Game instance.");
        }
        this.eventBus = eventBus;
        this.game = game;
        this.interactionModel = interactionModel;
        this.activePreview = null;
        this.stagedHex = null;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.subscribe('previewAction', (payload) => this.showPreview(payload));
        this.eventBus.subscribe('clearPreview', () => this.clearPreview());
        this.eventBus.subscribe('entityAction', () => this.clearPreview());
        this.eventBus.subscribe('mouseMovedOnMap', (payload) => this._handleMouseMove(payload));
        this.eventBus.subscribe('mapRightClicked', () => this.clearPreview());
        this.eventBus.subscribe('mapClicked', (payload) => this._handleMapClick(payload));
    }

    showPreview(payload) {
        this.clearPreview();
        switch (payload.type) {
            case 'move':
                this._drawMovementRangePreview();
                break;
            case 'skill_target':
                this._drawSkillRangePreview(payload.details);
                break;
        }
    }

    clearPreview() {
        this.game.renderer?.clearAllPreviews();
        this.activePreview = null;
        this.stagedHex = null;
    }

    _drawMovementRangePreview() {
        const player = this.game.player;
        if (!player) return;

        const movementRange = player.getComponent('movement')?.getEffectiveMovementRange() || 0;
        const reachableTiles = this.game.gameMap.getTilesInRange(player.hex, movementRange).filter(tile => {
            if (tile.isObstacle) return false;
            const entitiesOnTile = this.game.gameMap.getEntitiesAt(tile.q, tile.r);
            // A tile is reachable if no entity on it blocks movement.
            return !entitiesOnTile.some(e => e.blocksMovement);
        });

        this.game.renderer.showRangePreview({ tiles: reachableTiles, layout: this.game.layout });

        if (reachableTiles.length > 0) {
            this.activePreview = {
                type: 'move',
                tiles: new Map(reachableTiles.map(t => [`${t.q},${t.r}`, t]))
            };
        }
    }

    _drawSkillRangePreview({ skillId }) {
        const skill = this.game.player.getComponent('skills').getSkill(skillId);
        if (!skill) return;

        // Get all tiles within the skill's raw range.
        const potentialTiles = this.game.gameMap.getTilesInRange(this.game.player.hex, skill.range);
        let previewTiles = [];

        // Filter tiles based on the skill's specific targetType from CONFIG.js.
        // This makes the preview system more data-driven and scalable.
        switch (skill.targetType) {
            case 'empty_hex_range':
                // For skills like "Jump" that need an empty, non-obstacle tile.
                previewTiles = potentialTiles.filter(tile => {
                    if (tile.isObstacle) return false;
                    const entitiesOnTile = this.game.gameMap.getEntitiesAt(tile.q, tile.r);
                    return !entitiesOnTile.some(e => e.blocksMovement);
                });
                break;

            case 'hex_area':
            case 'hex_visible':
                // For skills that can target any tile (even occupied/obstacles).
                previewTiles = potentialTiles;
                break;

            default:
                previewTiles = potentialTiles;
                break;
        }
        this.game.renderer.showRangePreview({ tiles: previewTiles, layout: this.game.layout, overrideClassName: 'preview-tile skill-range-preview' });
        
        if (previewTiles.length > 0) {
            this.activePreview = {
                type: 'skill',
                tiles: new Map(previewTiles.map(t => [`${t.q},${t.r}`, t])),
                skill: skill,
            };
        }
    }

    _handleMouseMove({ hoveredHex }) {
        if (!hoveredHex) return; // Only check if there's a hex to hover over
        this._generatePreviewForHex(hoveredHex, false);
    }

    _handleMapClick({ clickedHex }) {
        if (!clickedHex) {
            this.clearPreview();
            return;
        }

        // --- DESKTOP: Click to Execute ---
        if (this.interactionModel === 'desktop') {
            this._executeActionForHex(clickedHex);
            return;
        }

        // --- MOBILE: Click to Stage, Click to Execute ---
        if (this.interactionModel === 'mobile') {
            // If user clicks the same hex that is already staged, execute the action.
            if (this.stagedHex && this.stagedHex.equals(clickedHex)) {
                this._executeActionForHex(clickedHex);
                // After execution, clear the staged hex and all previews
                this.stagedHex = null;
                this.clearPreview();
                return;
            }

            // This is a new click. It will now become the staged preview.
            // Clear previous dynamic layers and any previously staged hex.
            this.game.renderer.clearPathPreview();
            this.game.renderer.clearEffectPreview();
            
            // Generate the new dynamic preview (path/effect) and stage the hex.
            this._generatePreviewForHex(clickedHex);
            this.stagedHex = clickedHex;
        }
    }

    /**
     * Helper function to generate the dynamic part of the preview (path/effect).
     * This logic is shared between mouse move and mobile click staging.
     * @param {Tile} hex - The hex to generate the preview for.
     * @private
     */
    _generatePreviewForHex(hex) {
        this.game.renderer.clearPathPreview();
        this.game.renderer.clearEffectPreview();

        if (this.activePreview) {
            if (this.activePreview.tiles.has(`${hex.q},${hex.r}`)) {
                this._drawPathAndEffectForActivePreview(hex);
            }
        } else {
            const targetEntity = this.game.gameMap.getEntityAt(hex.q, hex.r);
            if (targetEntity && targetEntity.type !== 'player') {
                this._previewAttackOnHover(hex, targetEntity);
            } else {
                this._previewMovementPathOnHover(hex);
            }
        }
    }

    _executeActionForHex(targetHex) {
        const player = this.game.player;
        let actionType = null, details = {};

        // If a skill preview is active, the choice is a 'skill' action.
        if (this.activePreview && this.activePreview.type === 'skill') {
            if (this.activePreview.tiles.has(`${targetHex.q},${targetHex.r}`)) {
                actionType = 'skill';
                details = {
                    skillId: this.activePreview.skill.id,
                    targetHex: targetHex
                };
            }
        } else {
            // For any other click (move, attack, interact), we log the player's raw input intent.
            // The Game engine will be responsible for resolving this into a move, attack, or interaction.
            actionType = 'playerInput';
            details = {
                targetTile: targetHex
            };
        }

        if (actionType) {
            this.eventBus.publish('entityAction', {
                type: actionType,
                sourceId: player.id,
                details: details
            });
        } else {
            console.warn(`[TargetPreviewSystem] No valid action determined for ${targetHex.q},${targetHex.r}. Clearing preview.`);
            this.clearPreview();
        }
    }

    _drawPathAndEffectForActivePreview(hoveredHex) {
        const skill = this.activePreview.skill;
        const shouldDrawPath = this.activePreview.type === 'move' || (skill && skill.allowsMovement !== false);

        if (shouldDrawPath) {
            const path = this.game._findPath(this.game.player, hoveredHex);
            if (path) this.game.renderer.showPathPreview({ tiles: path, layout: this.game.layout });
        }

        const splashRadius = skill?.splashRadius || 0;
        const effectTiles = this.game.gameMap.getTilesInRange(hoveredHex, splashRadius);
        this.game.renderer.showEffectPreview({ tiles: effectTiles, layout: this.game.layout });
    }

    _previewAttackOnHover(hoveredHex, targetEntity) {
        const player = this.game.player;
        const moveRange = player.getComponent('movement')?.getEffectiveMovementRange() || 0;
        const { path } = this.game._findPathToAdjacent(player, targetEntity.hex, moveRange);

        if (path) {
            this.game.renderer.showPathPreview({ tiles: path, layout: this.game.layout });
            this.game.renderer.showEffectPreview({ tiles: [targetEntity.hex], layout: this.game.layout });
        } else if (player.hex.distance(targetEntity.hex) <= (player.getComponent('stats')?.attackRange || 1)) {
            this.game.renderer.showEffectPreview({ tiles: [targetEntity.hex], layout: this.game.layout });
        }
    }

    _previewMovementPathOnHover(hoveredHex) {
        const player = this.game.player;
        const moveRange = player.getComponent('movement')?.getEffectiveMovementRange() || 0;
        const path = this.game._findPath(player, hoveredHex);
        if (path && (path.length - 1) <= moveRange) {
            this.game.renderer.showPathPreview({ tiles: path, layout: this.game.layout });
            this.game.renderer.showEffectPreview({ tiles: [hoveredHex], layout: this.game.layout });
        }
    }
}

export default TargetPreviewSystem;