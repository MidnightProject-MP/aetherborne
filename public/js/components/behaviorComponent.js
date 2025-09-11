import CONFIG from '../config.js';

/**
 * Determines an entity's behavior by generating an intent for the turn.
 * This component acts as the "brain" for an AI-controlled entity. It reads the
 * game state and uses data-driven rules to decide what action to take, but
 * it does not execute the action itself.
 * @class BehaviorComponent
 */
class BehaviorComponent {
    constructor(config = {}) {
        this.name = 'behavior';
        /** @type {Entity|null} */
        this.entity = null;

        /**
         * The type of behavior pattern to use, mapping to a definition in CONFIG.
         * @type {string}
         */
        this.behaviorType = config.type || 'basicMelee';
    }

    /**
     * The core decision-making function for the AI. It evaluates the game state
     * and returns a single `IntentData` object for the turn.
     * This is called by the `IntentSystem`.
     * @returns {object} The IntentData object for the turn.
     */
    declareIntent() {
        if (!this.entity || !this.entity.game.player) {
            return this._createPassIntent('Missing core references');
        }

        const stats = this.entity.getComponent('stats');
        if (!stats || !stats.isAlive()) {
            return this._createPassIntent('Not alive');
        }

        const behaviorConfig = CONFIG.aiBehaviors[this.behaviorType];
        if (!behaviorConfig) {
            console.warn(`No AI behavior found in CONFIG for type: ${this.behaviorType}`);
            return this._createPassIntent('No behavior config');
        }

        for (const rule of behaviorConfig.rules) {
            const intent = this._evaluateRule(rule, stats);
            if (intent) {
                return intent;
            }
        }

        return this._createPassIntent('No viable action found');
    }

    /**
     * Evaluates a single rule from the AI behavior configuration.
     * @param {object} rule - A rule object from CONFIG.aiBehaviors.
     * @param {StatsComponent} stats - The stats component of this entity.
     * @returns {object|null} An IntentData object if the rule is valid, otherwise null.
     * @private
     */
    _evaluateRule(rule, stats) {
        const playerEntity = this.entity.game.player;
        const distanceToPlayer = this.entity.hex.distance(playerEntity.hex);
        const canAffordCost = stats.canAfford(rule.cost || 0);

        const conditionsMet = (rule.conditions || []).every(condition => {
            switch (condition.type) {
                case 'inAttackRange':
                    return distanceToPlayer <= (this.entity.getComponent('stats')?.attackRange || 1);
                case 'inAggroRange':
                    return distanceToPlayer <= (this.entity.getComponent('ai')?.aggroRange || 5);
                case 'canAfford':
                    return canAffordCost;
                default:
                    return true;
            }
        });

        if (conditionsMet) {
            switch (rule.action) {
                case 'attack':
                    return this._createAttackIntent(playerEntity, rule.cost);
                case 'moveToTarget':
                    const path = this.entity.game._findPath(this.entity, playerEntity.hex);
                    if (path && path.length > 1) {
                         return this._createMoveIntent(path, rule.cost);
                    }
                    break;
            }
        }
        
        return null;
    }
    
    _createAttackIntent(target, cost) {
        return { 
            type: 'attack', 
            actorId: this.entity.id, 
            targetType: 'entity', // Specify target type
            targetValue: target.id, // Store entity ID as target value
            cost: cost, 
            clarity: 'Full' 
        };
    }
    _createMoveIntent(path, cost) {
        const movementRange = this.entity.getComponent('movement').getEffectiveMovementRange();
        // Ensure path has at least one step beyond the current location
        if (path.length <= 1) return null; 

        // Determine the actual tile to move to, respecting movement range.
        // path[0] is current location, path[1] is the first step.
        // We want to move up to 'movementRange' steps.
        // So, the index in the path will be Math.min(path.length - 1, movementRange).
        const targetStepIndex = Math.min(path.length - 2, movementRange - 1);

        // If targetStepIndex is less than 0, it means we can't even take the first step (e.g., movementRange is 0)
        // or the path is just the current tile.
        if (targetStepIndex < 0) { 
            return null; 
        }
        const targetTile = path[targetStepIndex + 1]; // Get the actual tile object from the path

        return { 
            type: 'move', 
            actorId: this.entity.id, 
            targetType: 'tile', // Specify target type
            targetValue: { q: targetTile.q, r: targetTile.r }, // Store tile coordinates
            cost: cost, 
            clarity: 'Full' 
        };
    }
    _createPassIntent(reason) {
        return { type: 'pass', actorId: this.entity.id, reason: reason, clarity: 'Full' };
    }
}

export default BehaviorComponent;
