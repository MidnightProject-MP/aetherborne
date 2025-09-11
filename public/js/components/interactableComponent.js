/**
 * Handles generic interaction logic for entities like campfires, levers, etc.
 * @class InteractableComponent
 */
class InteractableComponent {
    constructor(config = {}) {
        this.name = 'interactable';
        this.entity = null; // Will be set by Entity.addComponent
        this.interactEffect = config.interactEffect || {}; // e.g., { type: 'rest', healAmount: 50 }
    }

    init() {
        // Interactables don't typically need anything on init
    }

    /**
     * Performs the interaction effect.
     * @param {Entity} interactingEntity - The entity performing the interaction (e.g., player).
     */
    interact(interactingEntity) {
        console.log(`[InteractableComponent] ${interactingEntity.name} interacts with ${this.entity.name}.`);
        const game = this.entity.game;
        const eventBus = game.eventBus;

        switch (this.interactEffect.type) {
            case 'rest':
                if (interactingEntity.hasComponent('stats')) {
                    const stats = interactingEntity.getComponent('stats');
                    const healAmount = this.interactEffect.healAmount || 0;
                    const restoreMP = this.interactEffect.restoreMP || 0;
                    stats.heal(healAmount);
                    stats.restoreMana(restoreMP);
                    eventBus.publish('combatLog', { message: `${interactingEntity.name} rests at the ${this.entity.name}, healing ${healAmount} HP and restoring ${restoreMP} MP.`, type: 'info' });
                }
                break;
            default:
                console.warn(`[InteractableComponent] Unknown interact effect type: ${this.interactEffect.type}`);
        }
    }

    destroy() {
        // Clean up
    }
}

export default InteractableComponent;