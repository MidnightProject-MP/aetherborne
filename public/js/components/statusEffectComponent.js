/**
 * Manages all status effects (buffs and debuffs) for an entity.
 * It tracks active statuses, their durations, and their effects.
 * @class StatusEffectComponent
 */
class StatusEffectComponent {
    constructor() {
        /** @type {string} */
        this.name = 'statusEffects';
        /** @type {Entity|null} */
        this.entity = null; // Will be set by Entity.addComponent
        /**
         * A map of active status effects, keyed by the status ID (e.g., 'fortified').
         * @private
         * @type {Object.<string, {id: string, effects: object[], duration: number}>}
         */
        this.activeStatuses = {};
    }

    /**
     * Applies a new status effect to the entity.
     * @param {string} statusId - The unique identifier for the status (e.g., 'fortified').
     * @param {object[]} effects - An array of effect objects that this status applies.
     * @param {number} duration - The duration of the status in turns (-1 for indefinite).
     */
    applyStatus(statusId, effects, duration) {
        if (!statusId || !effects) {
            console.warn(`StatusEffectComponent: Missing statusId or effects for ${this.entity.name}.`);
            return;
        }

        this.activeStatuses[statusId] = {
            id: statusId,
            effects: effects,
            duration: duration,
        };
        console.log(`${this.entity.name} gained status: ${statusId} for ${duration} turns.`);
        
        // Publish an event so other systems (like UI) can react.
        this.entity.game.eventBus.publish('statusEffectApplied', { 
            targetId: this.entity.id, 
            effect: this.activeStatuses[statusId] 
        });
    }

    /**
     * Removes a status effect from the entity.
     * @param {string} statusId - The ID of the status to remove.
     * @returns {boolean} True if the status was successfully removed.
     */
    removeStatus(statusId) {
        if (this.activeStatuses[statusId]) {
            delete this.activeStatuses[statusId];
            console.log(`${this.entity.name} lost status: ${statusId}.`);
            
            this.entity.game.eventBus.publish('statusEffectRemoved', { 
                targetId: this.entity.id, 
                statusId: statusId 
            });
            return true;
        }
        return false;
    }

    /**
     * Checks if the entity currently has a specific status effect.
     * @param {string} statusId - The ID of the status to check for.
     * @returns {boolean}
     */
    hasStatus(statusId) {
        return !!this.activeStatuses[statusId];
    }
    
    /**
     * Gathers all stat-modifying effects from all active statuses.
     * The StatsComponent will call this to calculate the final stat values.
     * @returns {object[]} An array of all active stat modifier effects.
     */
    getAllStatModifiers() {
        const modifiers = [];
        for (const statusId in this.activeStatuses) {
            const status = this.activeStatuses[statusId];
            if (status.effects && Array.isArray(status.effects)) {
                status.effects.forEach(effect => {
                    if (effect.type === 'stat_modifier') {
                        modifiers.push({ ...effect, sourceStatus: statusId });
                    }
                });
            }
        }
        return modifiers;
    }

    /**
     * Ticks down the duration of all active statuses.
     * This should be called once per round for the entity.
     */
    tickDurations() {
        const expiredEffects = [];
        for (const statusId in this.activeStatuses) {
            const status = this.activeStatuses[statusId];
            if (status.duration > 0) {
                status.duration--;
                if (status.duration === 0) {
                    expiredEffects.push(status);
                    this.removeStatus(statusId);
                }
            }
        }
        return expiredEffects;
    }
}

export default StatusEffectComponent;
