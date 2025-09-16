/**
 * @file entity-factory.js
 * @description A factory for creating game entities based on blueprints from the server-provided config.
 */

// Component imports
import StatsComponent from './components/statsComponent.js';
import RenderableComponent from './components/renderableComponent.js';
import MovementComponent from './components/movementComponent.js';
import SkillsComponent from './components/skillsComponent.js';
import PlayerInputComponent from './components/playerInputComponent.js';
import VisibilityComponent from './components/visibilityComponent.js';
import StatusEffectComponent from './components/statusEffectComponent.js';
import BehaviorComponent from './components/behaviorComponent.js';
import IntentComponent from './components/intentComponent.js';
import TrapComponent from './components/trapComponent.js';
import DetectionComponent from './components/detectionComponent.js';
import InteractableComponent from './components/interactableComponent.js';
import PortalComponent from './components/portalComponent.js';

import Entity from './entity.js';

// A map to avoid string-based lookups in the createEntity method
const componentClasses = {
    'StatsComponent': StatsComponent,
    'RenderableComponent': RenderableComponent,
    'MovementComponent': MovementComponent,
    'SkillsComponent': SkillsComponent,
    'PlayerInputComponent': PlayerInputComponent,
    'VisibilityComponent': VisibilityComponent,
    'StatusEffectComponent': StatusEffectComponent,
    'BehaviorComponent': BehaviorComponent,
    'IntentComponent': IntentComponent,
    'TrapComponent': TrapComponent,
    'DetectionComponent': DetectionComponent,
    'InteractableComponent': InteractableComponent,
    'PortalComponent': PortalComponent
};

export default class EntityFactory {
    constructor(game) {
        this.game = game;
        this.config = game.CONFIG; // Use the config from the game instance
    }

    /**
     * Creates an entity based on a blueprint type and initial properties.
     * @param {string} type - The type of entity to create (e.g., 'player', 'goblinScout').
     * @param {object|null} initialCoords - The initial {q, r} coordinates.
     * @param {object} properties - Additional properties to override or add to the blueprint.
     * @returns {Entity|null} The created entity or null if the blueprint is not found.
     */
    createEntity(type, initialCoords, properties = {}) {
        // For specific enemy types like 'goblinScout', we find its base blueprint (e.g., 'enemy')
        const blueprintType = this.config.entityBlueprints[type] ? type : 'enemy';
        const blueprint = this.config.entityBlueprints[blueprintType];

        if (!blueprint) {
            console.error(`[EntityFactory] No blueprint found for type: ${type}`);
            return null;
        }

        // Add logging for portal creation
        if (type === 'portal') {
            console.log(`[EntityFactory] Creating 'portal' entity with properties:`, properties);
        }

        // 1. Combine all properties into a single config object for the Entity constructor.
        // This ensures properties from the blueprint, the map file, and the type are all correctly applied.
        const entityConfig = {
            ...blueprint.entityProperties, // Start with blueprint defaults (e.g., zIndex, blocksMovement)
            ...properties,                 // Override with properties from the map file (e.g., name, nextMapId)
            type: type,                    // Ensure the primary type is set
            ...(initialCoords || {})       // Add q, r coordinates if they exist
        };

        // 2. Create the entity instance using the unified config.
        const entity = new Entity(this.game, entityConfig);

        // Add components based on the blueprint
        for (const compConfig of blueprint.components) {
            const ComponentClass = componentClasses[compConfig.class];
            if (ComponentClass) {
                // Pass the map-defined properties to the component argument getter.
                // This is important for components that need specific map data (like PortalComponent needing nextMapId).
                const args = this._getComponentArgs(compConfig, properties);
                const component = new ComponentClass(args);
                entity.addComponent(component);
            } else {
                console.error(`[EntityFactory] Unknown component class: ${compConfig.class}`);
            }
        }

        return entity;
    }

    /**
     * Gathers the arguments for a component's constructor based on the blueprint config.
     * @private
     */
    _getComponentArgs(compConfig, entityProperties) {
        if (!compConfig.argsSource) {
            return compConfig.args || {};
        }

        switch (compConfig.argsSource) {
            case 'archetypeBaseStats':
                // Combine baseStats with top-level properties like traits
                // so the StatsComponent receives all necessary data.
                return { ...(entityProperties.baseStats || {}), traits: entityProperties.traits || [] };
            case 'archetypeSkills':
                return { skillIds: entityProperties.skills || [] };
            case 'entityProperties':
                // If a dataSourceKey is provided, use that sub-object from the entity's properties.
                if (compConfig.class === 'PortalComponent') {
                    console.log(`[EntityFactory] Getting args for PortalComponent from entityProperties:`, entityProperties);
                }
                if (compConfig.dataSourceKey) {
                    return entityProperties[compConfig.dataSourceKey] || compConfig.args || {};
                }
                // Otherwise, pass the entire properties object. This is useful for components like PortalComponent
                // that read top-level properties like 'nextMapId'.
                return entityProperties;
            default:
                return compConfig.args || {};
        }
    }
}