/**
 * Defines the visual properties of an entity.
 * The actual rendering is handled by the SVGRenderer system.
 * @class RenderableComponent
 * @property {string} name - The name of the component ('renderable').
 * @property {Entity|null} entity - The entity this component belongs to.
 * @property {number} radius - The radius of the entity's visual representation (for circle-based visuals).
 * @property {string} fillColor - The fill color of the entity's visual representation.
 * @property {string} cssClass - The base CSS class for the entity's visual element.
 * @property {number} zIndex - The z-index for visual stacking order.
 */
class RenderableComponent {
    constructor(config = {}) {
        this.name = 'renderable';
        /** @type {Entity|null} */
        this.entity = null;

        // Visual properties from config
        this.radius = config.radius || 12;
        this.fillColor = config.fillColor || 'grey';
        this.cssClass = config.cssClass || 'entity-visual';
        this.zIndex = config.zIndex ?? 0; // New: visual stacking order
    }

    /**
     * Initializes the component after being added to an entity.
     * Creates the visual element and places it on the map.
     */
    init() {
        if (!this.entity) {
            console.error("[Renderable] Cannot init: Entity not set.");
            return;
        }
        // The SVGRenderer will handle creating the visual element when it receives the 'entityCreated' event.
        // This component now only provides the data for rendering.
        console.log(`%c[RenderableComponent] Data initialized for ${this.entity.name}`, "color: orange;");
        // The SVGRenderer listens to 'entityCreated' and will then call addEntityToRender
        // No explicit call needed here, as the entity is added to gameMap.entities, which triggers 'entityCreated'
    }

    /**
     * Updates the visual position of the entity on the map based on its hex coordinates.
     * This method now publishes an event for the SVGRenderer to handle the actual visual update.
     */
    updatePosition() {
        if (this.entity && this.entity.hex) {
            // The SVGRenderer is already subscribed to 'entityMoved'
            this.entity.game.eventBus.publish('entityMoved', { entityId: this.entity.id, finalHex: this.entity.hex });
            console.log(`[RenderableComponent] Published 'entityMoved' for ${this.entity.name}`);
        } else {
             console.warn(`[RenderableComponent] Could not publish 'entityMoved' for ${this.entity.name}. Missing entity or hex.`, { hasEntity: !!this.entity, hasHex: !!this.entity?.hex });
        }
    }

    /**
     * Sets the visibility of the entity's visual element.
     * This method now publishes an event for the SVGRenderer to handle the actual visual update.
     * @param {boolean} isVisible - True to show, false to hide.
     */
    setVisibility(isVisible) {
        if (this.entity) {
            // The SVGRenderer will need to subscribe to this new event
            this.entity.game.eventBus.publish('entityVisibilityChanged', { entityId: this.entity.id, isVisible: isVisible });
            console.log(`[RenderableComponent] Published 'entityVisibilityChanged' for ${this.entity.name}: ${isVisible}`);
        }
    }

    /**
     * Removes the visual element from the DOM when the entity is destroyed.
     */
    destroy() {
        if (this.entity) {
            // The SVGRenderer is already subscribed to 'entityRemoved'
            this.entity.game.eventBus.publish('entityRemoved', { entityId: this.entity.id });
            console.log(`[RenderableComponent] Published 'entityRemoved' for ${this.entity.name}`);
        }
    }
}

export default RenderableComponent;
