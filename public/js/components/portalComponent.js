import InteractableComponent from './interactableComponent.js';

/**
 * Handles the logic for a portal entity, extending generic interaction.
 * @class PortalComponent
 * @extends InteractableComponent
 */
class PortalComponent extends InteractableComponent {
    constructor(config = {}) {
        // Portals are a specific type of interactable
        super(config); // Pass config to the parent InteractableComponent
        this.name = 'portal'; // Override name if needed, or keep 'interactable'
        this.nextMapId = config.nextMapId || null; // The ID of the map to transition to
    }

    /**
     * Overrides the generic interact method to handle map transitions.
     * @param {Entity} interactingEntity - The entity interacting with the portal.
     */
    interact(interactingEntity) {
        if (this.nextMapId) {
            console.log(`[PortalComponent] ${interactingEntity.name} enters portal to ${this.nextMapId}.`);
            this.entity.game.eventBus.publish('combatLog', { message: `${interactingEntity.name} steps into the portal...`, type: 'event' });
            this.entity.game.eventBus.publish('mapTransitionRequest', { nextMapId: this.nextMapId, entityId: interactingEntity.id });
        } else {
            console.warn(`[PortalComponent] Portal ${this.entity.name} has no nextMapId configured.`);
            this.entity.game.eventBus.publish('combatLog', { message: `The portal shimmers, but leads nowhere.`, type: 'warning' });
        }
    }

    destroy() {
        // Clean up
    }
}

export default PortalComponent;