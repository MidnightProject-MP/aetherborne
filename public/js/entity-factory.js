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

        const entity = new Entity(this.game, type, properties.name || type);
        
        // Assign properties from the blueprint and overrides from the map config
        Object.assign(entity, blueprint.entityProperties, properties);
        entity.initialCoords = initialCoords;

        // Add components based on the blueprint
        for (const compConfig of blueprint.components) {
            const ComponentClass = componentClasses[compConfig.class];
            if (ComponentClass) {
                const args = this._getComponentArgs(compConfig, properties);
                const component = new ComponentClass(entity, args);
                entity.addComponent(compConfig.name, component);
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
                return entityProperties.baseStats || {};
            case 'archetypeSkills':
                return { skillIds: entityProperties.skills || [] };
            case 'entityProperties':
                return entityProperties[compConfig.dataSourceKey] || compConfig.args || {};
            default:
                return compConfig.args || {};
        }
    }
}