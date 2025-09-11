/**
 * Manages the entire lifecycle of AI intents for a turn.
 * It generates, reveals, and resolves intents based on the game's combat loop.
 * @class IntentSystem
 */
class IntentSystem {
    /**
     * @param {object} eventBus - The global event bus instance.
     * @param {object} game - A reference to the main game instance.
     */
    constructor(eventBus, game) {
        if (!eventBus || !game) {
            throw new Error("IntentSystem requires an EventBus and a Game instance.");
        }
        /** @private */
        this.eventBus = eventBus;
        /** @private */
        this.game = game;

        this._setupEventListeners();
    }

    /**
     * Subscribes the system to relevant game events.
     * @private
     */
    _setupEventListeners() {
        // When player's turn ends, enemies take their actions based on stored intents.
        this.eventBus.subscribe('playerTurnEnded', () => this.executeStoredIntents());
        // After all enemies have acted, they declare their new intents for the next turn.
        this.eventBus.subscribe('allEnemyActionsResolved', () => this.generateAndDeclareNewIntents());
    }

    /**
     * Generates new intents for all AI entities for the *next* turn, stores them,
     * and publishes an event for the UI to reveal these new intents.
     */
    generateAndDeclareNewIntents() {
        console.log("[IntentSystem] Generating and declaring new intents for next turn...");
        const newIntentsForUI = [];

        // Use the getEnemies() getter which correctly filters for entities with a BehaviorComponent.
        // This was the source of the previous TypeError, as gameMap.enemies no longer exists.
        // getEnemies() returns an array, which is safe for forEach.
        const enemies = this.game.gameMap.getEnemies();
        enemies.forEach(enemy => {
            if (enemy.getComponent('stats')?.isAlive()) {
                const behaviorComp = enemy.getComponent('behavior');
                const intentComp = enemy.getComponent('intent');

                if (behaviorComp && intentComp) {
                    const newIntentData = behaviorComp.declareIntent(); // AI decides its next move
                    intentComp.setCurrentIntent(newIntentData);      // Store it
                    newIntentsForUI.push({ // Data for UI to reveal
                        entityId: enemy.id,
                        intent: newIntentData // Or a "revealed" version if clarity levels exist
                    });
                }
            }
        });

        // Publish event for UI to update intent icons and for Game to proceed.
        // The game loop is waiting for 'intentsDeclared', not 'newEnemyIntentsDeclared'.
        this.eventBus.publish('intentsDeclared', { intents: newIntentsForUI });
        console.log("[IntentSystem] New intents declared and published.");
    }

    /**
     * Executes actions for all enemies based on their *currently stored* intents.
     */
    executeStoredIntents() {
        console.log("[IntentSystem] === EXECUTING ENEMY ACTIONS ===");
        // Use the getEnemies() getter here as well for consistency and correctness.
        const enemies = this.game.gameMap.getEnemies();
        for (const enemy of enemies) {
            if (!enemy.getComponent('stats')?.isAlive()) {
                continue;
            }

            const intentComp = enemy.getComponent('intent');
            const storedIntent = intentComp?.getCurrentIntent(); // Get the intent stored from previous phase

            if (!storedIntent) {
                console.log(`[IntentSystem] Enemy ${enemy.name} has no stored intent.`);
                continue;
            }

            console.log(`[IntentSystem] Enemy ${enemy.name} executing stored intent:`, storedIntent);

            let resolvedTargetTile = null;
            let resolvedTargetId = null;

            if (storedIntent.targetType === 'tile' && storedIntent.targetValue) {
                resolvedTargetTile = storedIntent.targetValue; // targetValue is {q, r}
            } else if (storedIntent.targetType === 'entity' && storedIntent.targetValue) {
                const targetEntity = this.game.getEntity(storedIntent.targetValue); // targetValue is entity ID
                if (targetEntity?.hex) {
                    resolvedTargetTile = { q: targetEntity.hex.q, r: targetEntity.hex.r };
                    resolvedTargetId = targetEntity.id;
                } else {
                    console.log(`[IntentSystem] Target entity ${storedIntent.targetValue} for ${enemy.name}'s intent not found or has no position. Action may fail or be re-evaluated.`);
                    // Optionally, the enemy could try to pick a new action or pass.
                    // For now, if the target is gone, the action might just not happen if it requires a specific target.
                }
            }

            // Construct details for entityAction based on intent type
            const actionDetails = {};
            if (storedIntent.type === 'attack' && resolvedTargetId) {
                actionDetails.targetId = resolvedTargetId;
            } else if (storedIntent.type === 'move' && resolvedTargetTile) {
                actionDetails.targetTile = resolvedTargetTile;
            } else if (storedIntent.type === 'skill' && storedIntent.skillId) { // Example for a skill
                actionDetails.skillId = storedIntent.skillId;
                if (resolvedTargetId) actionDetails.targetId = resolvedTargetId;
                if (resolvedTargetTile) actionDetails.targetHex = resolvedTargetTile; // If skill targets a hex
            }
            // Add other necessary details from storedIntent if actions need them
            // e.g., actionDetails.cost = storedIntent.cost;

            if (storedIntent.type !== 'pass') {
                // Publish an action event for the Game class to resolve.
                this.eventBus.publish('entityAction', { // Assuming 'playerAction' was renamed to 'entityAction'
                    type: storedIntent.type,
                    sourceId: enemy.id,
                    details: actionDetails
                });
            } else {
                console.log(`[IntentSystem] Enemy ${enemy.name} passes the turn (intent: ${storedIntent.reason}).`);
            }
        }
        console.log("[IntentSystem] === ALL ENEMY ACTIONS PROCESSED ===");
        // Signal that all enemies have completed their actions for this turn.
        this.eventBus.publish('allEnemyActionsResolved');
        console.log("[IntentSystem] allEnemyActionsResolved event published.");
    }
}

export default IntentSystem;
