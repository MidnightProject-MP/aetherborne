/**
 * Manages an entity's ability to move on the game map.
 * This component holds movement-related data and is responsible for executing
 * the visual animation of movement along a given path. It does not decide
 * when to move or calculate the path itself.
 * @class MovementComponent
 */
class MovementComponent {
    constructor(config = {}) {
        this.name = 'movement';

        /** @type {Entity|null} */
        this.entity = null;

        /** @type {number} The base movement range before modifiers. */
        this.movementRange = config.movementRange ?? 3;
        /** @type {boolean} True if the entity is currently animating its movement. */
        this.isMoving = false;
        /** @private */
        this.stepDuration = config.stepDuration ?? 120; // ms per step

    }

    /**
     * Returns the effective movement range for this entity based on current AP.
     * This is a dynamic value used for previews and action validation.
     */
    getEffectiveMovementRange() {
        const stats = this.entity.getComponent('stats');
        // Ensure we have access to the game's config for move cost.
        const moveCost = this.entity.game?.CONFIG?.actions?.moveCost || 1;

        if (stats && moveCost > 0) {
            const currentAP = stats.getCurrentAP();
            return Math.floor(currentAP / moveCost);
        }

        // Fallback to max range if stats or cost are unavailable.
        return this.movementRange;
    }

    /**
     * Returns the maximum possible movement range for this entity, ignoring AP cost.
     * This is a static value useful for tooltips or character sheets.
     */
    getMaxMovementRange() {
        return this.movementRange;
    }

    /**
     * Animates the entity along the given path (array of tiles).
     * This now works by publishing an event for the SVGRenderer to handle the animation.
     * @param {Array<Tile>} path - An array of Tile objects for the movement path.
     * @returns {Promise<object>} A promise that resolves when the movement is complete.
     */
    moveTo(path) {
        if (this.isMoving) {
            return Promise.reject("Cannot start a new move: Animation already in progress.");
        }
        if (!Array.isArray(path) || path.length < 2) {
            return Promise.resolve({ moved: false, reason: "Invalid path provided." });
        }

        this.isMoving = true;

        return new Promise((resolve, reject) => {
            this.entity.game.eventBus.publish('entityAnimateMove', {
                entityId: this.entity.id,
                path: path,
                stepDuration: this.stepDuration,
                onComplete: (result) => {
                    this.isMoving = false;
                    resolve(result);
                },
                onError: (error) => {
                    this.isMoving = false;
                    reject(error);
                }
            });
        });
    }
}

export default MovementComponent;
