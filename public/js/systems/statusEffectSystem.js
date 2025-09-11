import CONFIG from '../config.js';
/**
 * Manages the lifecycle of all status effects across all entities.
 * It applies, removes, and ticks down the duration of effects.
 * @class StatusEffectSystem
 */
class StatusEffectSystem {
    constructor(eventBus, game) {
        if (!eventBus || !game) {
            throw new Error("StatusEffectSystem requires an EventBus and a Game instance.");
        }
        this.eventBus = eventBus;
        this.game = game;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.subscribe('applyStatusEffect', (payload) => this.applyStatus(payload));
        this.eventBus.subscribe('turnStarted', (payload) => {
            // Tick durations at the start of the relevant entity's turn segment
            if (payload.currentTurn === 'player') {
                this.tickDurationsForEntity(this.game.player);
            } else if (payload.currentTurn === 'enemies') {
                // Use the getEnemies() getter which correctly filters for entities with a BehaviorComponent.
                this.game.gameMap.getEnemies().forEach(enemy => this.tickDurationsForEntity(enemy));
            }
        });
    }

    /**
     * Applies a status effect to a target entity.
     * @param {object} payload - The event payload.
     * @param {string} payload.targetId - The ID of the entity to receive the status.
     * @param {string} payload.effectId - The ID of the status effect from CONFIG.statusEffects.
     * @param {number} [payload.durationOverride] - Optional duration to override the default.
     */
    applyStatus({ targetId, effectId, durationOverride }) {
        const target = this.game.getEntity(targetId);
        if (!target) {
            console.warn(`[StatusEffectSystem] Target entity ${targetId} not found for effect ${effectId}.`);
            return;
        }
        
        const statusComp = target.getComponent('statusEffects'); // Assuming StatusEffectComponent exists
        if (!statusComp) {
            console.warn(`[StatusEffectSystem] Entity ${target.name} has no StatusEffectComponent.`);
            return;
        }

        const effectConfig = CONFIG.statusEffects[effectId];
        if (!effectConfig) {
            console.warn(`[StatusEffectSystem] Status effect config for "${effectId}" not found.`);
            return;
        }

        // Call the correct method on the component with the correct arguments
        statusComp.applyStatus(
            effectConfig.id, 
            effectConfig.effects, 
            durationOverride ?? effectConfig.duration);
        console.log(`[StatusEffectSystem] Applied status "${effectConfig.name}" to ${target.name}.`);
        // Optionally, publish an event that a status was applied for UI updates
        this.eventBus.publish('statusEffectApplied', { entityId: targetId, effect: effectConfig });
    }

    /**
     * Ticks down the duration of status effects on a single entity.
     * @param {Entity} entity - The entity whose status effects should be ticked.
     */
    tickDurationsForEntity(entity) {
        if (entity) {
            const statusComp = entity.getComponent('statusEffects');
            if (statusComp) {
                const expiredEffects = statusComp.tickDurations();
                if (expiredEffects.length > 0) {
                    // Optionally publish event for UI if effects expired
                    this.eventBus.publish('statusEffectExpired', { entityId: entity.id, effects: expiredEffects });
                }
            }
        }
    }
}

export default StatusEffectSystem;
