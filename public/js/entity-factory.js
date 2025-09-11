import Entity from './entity.js';
import entityDefinitions from '../data/entities/index.js';
import CONFIG from './config.js';

// Component Imports
import StatsComponent from './components/statsComponent.js';
import RenderableComponent from './components/renderableComponent.js';
import MovementComponent from './components/movementComponent.js';
import SkillsComponent from './components/skillsComponent.js';
import PlayerInputComponent from './components/playerInputComponent.js';
import BehaviorComponent from './components/behaviorComponent.js';
import IntentComponent from './components/intentComponent.js';
import ReactionComponent from './components/reactionComponent.js';
import StatusEffectComponent from './components/statusEffectComponent.js';
import VisibilityComponent from './components/visibilityComponent.js';
import DetectionComponent from './components/detectionComponent.js'; // New: Import DetectionComponent
import TrapComponent from './components/trapComponent.js';
import InteractableComponent from './components/interactableComponent.js';
import PortalComponent from './components/portalComponent.js';

const componentRegistry = {
    StatsComponent, RenderableComponent, MovementComponent, SkillsComponent,
    PlayerInputComponent, BehaviorComponent, IntentComponent,
    ReactionComponent, StatusEffectComponent, VisibilityComponent, DetectionComponent, // New: Add DetectionComponent
    TrapComponent, InteractableComponent, PortalComponent
};

class EntityFactory {
    constructor(game) {
        this.game = game;
        this.definitions = entityDefinitions; // Assign to a property
    }

    createEntity(entityType, initialCoords, instanceSpecificData = {}) {
        // 1. Get the base definition for the entity type.
        const baseEntityDefinition = this.definitions[entityType];
        if (!baseEntityDefinition) {
            throw new Error(`[EntityFactory] No definition found for entity type: ${entityType}`);
        }

        // 2. Merge base definition with instance-specific data (e.g., from map file or character creation).
        const resolvedEntityData = { ...baseEntityDefinition, ...instanceSpecificData };

        // 3. Determine the blueprint to use for components.
        const isPlayer = (entityType === 'player');

        let blueprintType = isPlayer ? 'player' : resolvedEntityData.blueprint;
        
        if (!blueprintType) {
            // Fallback for older definitions or simple entities.
            // We can try to infer it from the entity's own 'type' property.
            blueprintType = resolvedEntityData.type;
            console.warn(`[EntityFactory] Entity type "${entityType}" has no 'blueprint' property. Falling back to blueprint type: '${blueprintType}'.`);
        }
        
        const blueprint = CONFIG.entityBlueprints?.[blueprintType];

        if (!blueprint) {
            throw new Error(`[EntityFactory] No component blueprint found for type: "${blueprintType}"`);
        }
        
        // 4. Handle player-specific archetype data.
        let archetypeConfig = null;
        if (isPlayer) {
            const archetypeId = resolvedEntityData.archetype || 'warrior';
            archetypeConfig = CONFIG.archetypes[archetypeId];
            if (!archetypeConfig) {
                console.error(`[EntityFactory] Archetype config for "${archetypeId}" not found. Defaulting to warrior.`);
                archetypeConfig = CONFIG.archetypes.warrior;
            }
        }

        // 5. Build the final config for the Entity constructor.
        const entityConfig = {
            type: resolvedEntityData.type || entityType, // e.g. 'enemy', 'trap', 'player'
            name: resolvedEntityData.name || (isPlayer ? archetypeConfig.name : entityType),
            archetype: isPlayer ? (resolvedEntityData.archetype || 'warrior') : undefined,
            ...resolvedEntityData,
            ...initialCoords
        };

        // 6. Create the Entity instance.
        const entity = new Entity(this.game, entityConfig);

        // 7. Add components based on the blueprint.
        blueprint.components.forEach(compBlueprint => {
            const ComponentClass = componentRegistry[compBlueprint.class];
            if (ComponentClass) {
                const componentArgs = this._getComponentArguments(compBlueprint, entityType, resolvedEntityData, archetypeConfig);
                entity.addComponent(new ComponentClass(componentArgs));
            } else {
                console.warn(`Component class ${compBlueprint.class} not found in registry.`);
            }
        });

        return entity;
    }

    _getComponentArguments(compBlueprint, entityType, resolvedEntityData, archetypeConfig) {
        let componentArgs = { ...(compBlueprint.args || {}) }; // Start with blueprint's default args

        switch (compBlueprint.argsSource) {
            case 'archetypeBaseStats': // For Player's StatsComponent & MovementComponent
                if (entityType === 'player' && archetypeConfig) {
                    componentArgs = { ...componentArgs, ...archetypeConfig.baseStats };
                }
                break;
            case 'archetypeSkills': // For Player's SkillsComponent
                if (entityType === 'player' && archetypeConfig) {
                    // Map skill IDs to full skill data from CONFIG.skills
                    const skillsData = archetypeConfig.skills.map(skillId => {
                        const skillConfig = CONFIG.skills[skillId];
                        if (!skillConfig) {
                            console.warn(`[EntityFactory] Skill config for ID "${skillId}" not found for archetype "${archetypeConfig.name}".`);
                            return null;
                        }
                        return { ...skillConfig }; // Pass a copy of the skill config
                    }).filter(Boolean);
                    componentArgs = { ...componentArgs, skillsData: skillsData };
                }
                break;
            case 'entityProperties': // For enemies or general properties
                if (compBlueprint.dataSourceKey && resolvedEntityData[compBlueprint.dataSourceKey]) {
                    componentArgs = { ...componentArgs, ...resolvedEntityData[compBlueprint.dataSourceKey] };
                } else if (!compBlueprint.dataSourceKey) {
                    // If no dataSourceKey is specified, pass all the resolved entity data.
                    // This is useful for components like PortalComponent that need top-level properties.
                    componentArgs = { ...componentArgs, ...resolvedEntityData };
                } else {
                    console.warn(`[EntityFactory] dataSourceKey "${compBlueprint.dataSourceKey}" not found in resolvedEntityData for ${compBlueprint.name}.`);
                }
                break;
            case 'characterData': // Generic catch-all for player if needed, less specific than archetype sources
                 if (entityType === 'player') {
                    componentArgs = { ...componentArgs, ...resolvedEntityData }; // resolvedEntityData is characterData
                }
                break;
            default:
                // If no argsSource, componentArgs remains as defined in blueprint.args
                break;
        }
        // Special handling for RenderableComponent
        if (compBlueprint.class === 'RenderableComponent' && resolvedEntityData.renderable?.imagePath) {
            componentArgs.imagePath = resolvedEntityData.renderable.imagePath;
        } else if (compBlueprint.class === 'RenderableComponent') {
            // Ensure enemies get a default red color if not specified
            if (entityType !== 'player' && !componentArgs.fillColor && !componentArgs.imagePath) {
                componentArgs.fillColor = 'red';
            }
            // Ensure a default radius if none is provided and it's not an image
            if (!componentArgs.radius && !componentArgs.imagePath) {
                componentArgs.radius = entityType === 'player' ? this.game.hexSize.x * 0.7 : this.game.hexSize.x * 0.45;
            }
            // Ensure displaySize for images if radius is not applicable
            if (componentArgs.imagePath && !componentArgs.displaySize) {
                componentArgs.displaySize = { x: this.game.hexSize.x * 1.5, y: this.game.hexSize.y * 1.5};
            }
        }


        return componentArgs;
    }
}

export default EntityFactory;
