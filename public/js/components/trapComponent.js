/**
 * Handles the logic for a trap entity.
 * @class TrapComponent
 */
class TrapComponent {
    constructor(config = {}) {
        this.name = 'trap';
        this.entity = null; // Will be set by Entity.addComponent
        this.trapEffect = config.trapEffect || {}; // e.g., { type: 'damage', amount: 10, damageType: 'physical' }
        this.trigger = config.trigger || 'onEnter'; // 'onEnter', 'onStepOff'
        this.reusable = config.reusable || false;
        this.triggered = false; // Internal state
    }

    init() {
        // Traps don't typically need to do anything on init,
        // their logic is usually triggered by other systems (e.g., MovementSystem, Game.resolveMoveAction)
    }

    /**
     * Activates the trap's effect on a target entity.
     * @param {Entity} targetEntity - The entity that triggered the trap.
     */
    activate(targetEntity) {
        if (this.triggered && !this.reusable) {
            console.log(`[TrapComponent] ${this.entity.name} already triggered and not reusable.`);
            return;
        }

        console.log(`[TrapComponent] ${this.entity.name} activated by ${targetEntity.name}!`);
        this.triggered = true;

        // If the trap was concealed, reveal it upon activation
        if (this.entity.isConcealed) {
            this.entity.isConcealed = false;
            this.entity.getComponent('renderable')?.setVisibility(true);
        }

        const game = this.entity.game;
        const eventBus = game.eventBus;

        switch (this.trapEffect.type) {
            case 'damage':
                if (targetEntity.hasComponent('stats')) {
                    const damageAmount = this.trapEffect.amount || 0;
                    const damageType = this.trapEffect.damageType || 'physical';
                    targetEntity.getComponent('stats').takeDamage(damageAmount);
                    eventBus.publish('combatLog', { message: `${targetEntity.name} stepped on a ${this.entity.name} and took ${damageAmount} ${damageType} damage!`, type: 'damage' });
                }
                break;
            case 'status':
                if (game.statusEffectSystem && this.trapEffect.statusId) {
                    game.statusEffectSystem.applyStatus({ targetId: targetEntity.id, effectId: this.trapEffect.statusId, durationOverride: this.trapEffect.duration });
                    eventBus.publish('combatLog', { message: `${targetEntity.name} was affected by ${this.entity.name} (${this.trapEffect.statusId})!`, type: 'status' });
                }
                break;
            default:
                console.warn(`[TrapComponent] Unknown trap effect type: ${this.trapEffect.type}`);
        }

        if (!this.reusable) {
            eventBus.publish('combatLog', { message: `${this.entity.name} is consumed.`, type: 'event' });
            game.removeEntity(this.entity.id);
        }
    }

    destroy() {
        // Clean up any listeners if added, or visual effects
    }
}

export default TrapComponent;