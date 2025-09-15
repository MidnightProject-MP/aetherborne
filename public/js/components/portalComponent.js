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
        // The logic to handle the transition (or end the game) is in the Game class.
        // This component's only job is to publish the request.
        const message = this.nextMapId
            ? `${interactingEntity.name} steps into the portal...`
            : `${interactingEntity.name} steps through the final portal, completing the dungeon!`;

        this.entity.game.eventBus.publish('combatLog', { message, type: 'event' });

        // Always publish the request. The Game class will handle a null/undefined nextMapId.
        this.entity.game.eventBus.publish('mapTransitionRequest', { nextMapId: this.nextMapId, entityId: interactingEntity.id });
    }

    destroy() {
        // Clean up
    }
}

export default PortalComponent;