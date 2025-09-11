import { generateUUID } from './utils.js';

/**
 * The base class for all objects in the game world (e.g., player, enemies, items).
 * An Entity is a simple container for Components, which define its behavior and data.
 * @class Entity
 */
class Entity {
    /**
     * @param {object} game - A reference to the main game instance.
     * @param {object} [config={}] - Configuration data for the entity.
     */
    constructor(game, config = {}) {
        this.id = config.id || generateUUID();
        this.game = game;
        this.type = config.type || 'generic';
        this.name = config.name || this.type;
        this.hex = config.hex || null;
        this.components = {};
        this.blocksMovement = config.blocksMovement ?? false; // Does this entity block movement for others?
        this.isConcealed = config.isConcealed ?? false;     // Is this entity hidden from view?
        this.zIndex = config.zIndex ?? 0;                   // Visual stacking order (higher is on top)


        // Store initial position data if provided, for later use
        if (config.q !== undefined && config.r !== undefined) {
            this.initialCoords = { q: config.q, r: config.r };
        }
    }

    /**
     * Attaches a component instance to this entity.
     * Initialization is now handled separately by initComponents().
     * @param {object} componentInstance - The component to add. Must have a 'name' property.
     */
    addComponent(componentInstance) {
        this.components[componentInstance.name] = componentInstance;
        componentInstance.entity = this;
    }
    
    /**
     * Initializes all attached components. This should be called after an
     * entity is fully constructed and placed on the map.
     */
    initComponents() {
        console.log(`[Entity] Initializing components for ${this.name}`);
        for (const componentName in this.components) {
            const component = this.components[componentName];
            if (typeof component.init === 'function') {
                component.init();
            }
        }
    }

    getComponent(componentName) {
        return this.components[componentName];
    }

    hasComponent(componentName) {
        return !!this.components[componentName];
    }
    
    destroy() {
        for (const componentName in this.components) {
            const component = this.components[componentName];
            if (typeof component.destroy === 'function') {
                component.destroy();
            }
        }
        this.components = {};
    }
}

export default Entity;
