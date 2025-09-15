import { GameState } from './gameState.js';
import { Layout, Point } from './tile.js';
import GameMap from './map.js';
import EntityFactory from './entity-factory.js';
import SVGRenderer from './ui/svgRenderer.js'; // Import the new SVGRenderer
import DetectionSystem from './systems/detectionSystem.js'; // New: Import DetectionSystem
import { createSeededRNG } from './utils.js';

/**
 * Represents the core game logic, state, and main loop.
 */
export default class Game {
    /**
     * @param {EventBus} eventBus The central event bus.
     */
    constructor(eventBus, canvasId, hexSize, characterData, intentSystem = null, sessionData, config, isReplay = false) {
        this.eventBus = eventBus;
        this.canvasId = canvasId;
        this.hexSize = hexSize;
        this.characterData = characterData;
        this.CONFIG = config; // Expose CONFIG to other systems via the game instance
        this.intentSystem = intentSystem;
        this.statusEffectSystem = null;
        this.detectionSystem = null; // New: DetectionSystem instance
        this.visibilitySystem = null;
        this.interactionModel = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'mobile' : 'desktop';
        
        this.isReplay = isReplay;
        // --- Server-Authoritative Data ---
        this.sessionData = sessionData;
        this.sessionId = sessionData.sessionId;
        this.replayLog = []; // NEW: To record player actions for validation
        this.rng = createSeededRNG(sessionData.seed);
        console.log(`[Game] Initializing with session ${this.sessionId} and seed ${sessionData.seed}`);

        this.gameState = new GameState();
        this.gameState.isAnimating = false; // Add a flag to prevent actions during animations
        this.layout = null;
        this.renderer = null; // The new SVG renderer
        this.gameMap = null;
        this.entityFactory = null;
        this.player = null;
        this._intentsPrimed = false;
        this._lastHoveredHex = null;

        this.clickHandler = this.handleClick.bind(this);
        this.rightClickHandler = this.handleRightClick.bind(this);
        this._throttledMouseMove = Game.throttle(this.handleMouseMove.bind(this), 50);
    }

    async initializeLayoutAndMap(characterData, existingPlayer = null) {
        this.characterData = characterData;

        // 1. Wait for mapContainer to be ready
        const mapContainer = await new Promise(resolve => {
            const checkMapContainer = () => {
                const container = document.getElementById('map-container');
                if (container && container.clientWidth > 0 && container.clientHeight > 0) {
                    resolve(container);
                } else {
                    requestAnimationFrame(checkMapContainer);
                }
            };
            checkMapContainer();
        });

        // 2. Get map configuration
        const mapConfig = this.sessionData.mapTemplate;
        const mapId = mapConfig.id; // Assuming the template has an ID

        if (!mapConfig) {
            this.handleGameOver(`Error: Map config for ID "${mapId}" not found.`);
            return;
        }

        // 3. Create the final layout and renderer. The origin is (0,0) as viewBox will handle positioning.
        this.layout = new Layout(Layout.flat, this.hexSize, new Point(0, 0));
        this.gameMap = new GameMap(this.eventBus, this.layout, this.rng); // Pass the seeded RNG to the map
        this.renderer = new SVGRenderer(this.eventBus, this, this.canvasId);
        this.entityFactory = new EntityFactory(this);

        // 4. Create entity instances (without placing them yet)
        if (existingPlayer) {
            this.player = existingPlayer;
        } else {
            this.player = this.entityFactory.createEntity('player', null, this.characterData);
        }
        const enemies = this._createEntitiesFromConfig(mapConfig, 'enemies');
        const traps = this._createEntitiesFromConfig(mapConfig, 'traps');
        const campfires = this._createEntitiesFromConfig(mapConfig, 'campfires');
        const portals = this._createEntitiesFromConfig(mapConfig, 'portals');
        const allEntities = [this.player, ...enemies, ...traps, ...campfires, ...portals];

        // 5. Initialize the map data model (creates tiles, places entities in data)
        this.gameMap.initializeFromConfig({ mapConfig, entities: allEntities });

        // 6. Calculate map bounds and set the SVG viewBox to frame the content.
        // This makes the map responsive to the container size.
        const bounds = this.gameMap.calculateBounds();
        const padding = this.hexSize.x * 1.5; // Add some padding around the map
        const mapWidth = (bounds.maxX - bounds.minX) + (padding * 2);
        const mapHeight = (bounds.maxY - bounds.minY) + (padding * 2);
        const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${mapWidth} ${mapHeight}`;

        this.renderer.svgElement.setAttribute('viewBox', viewBox);

        // 7. Initialize entities (sets their .hex property and initializes components).
        this.initializeEntities(mapConfig);

        // 8. Run an initial visibility check. This updates the data model.
        // This ensures the tiles around the player are visible from the start.
        this.visibilitySystem?.updateVisibility();
        this.detectionSystem?.checkDetection();

        // 9. Trigger the first render.
        // The renderer will now draw the map with the correct initial visibility.
        this.eventBus.publish('mapLoaded', { mapConfig, entities: allEntities });

        // 10. Add event listeners for interaction
        this.addEventListeners();
        this._setupEventListeners();

        // 11. Generate initial intents now that the map and entities are fully initialized.
        // This must happen after all systems are set and the map is ready.
        if (this.intentSystem && !this._intentsPrimed) {
            this.intentSystem.generateAndDeclareNewIntents();
            this._intentsPrimed = true;
        }
    }

    _setupEventListeners() {
        this.eventBus.subscribe('entityAction', (payload) => {
            this.resolveEntityAction(payload);
        });
        if (!this.isReplay) {
            this.eventBus.subscribe('mapTransitionRequest', ({ nextMapId, entityId }) => {
                this.handleMapTransition(nextMapId, entityId);
            });
        }
        this.eventBus.subscribe('playerEndTurn', () => {
            this.endPlayerTurn();
        });
        this.eventBus.subscribe('entityDied', ({ entity }) => {
            // The StatsComponent is now responsible for publishing this event when an entity's HP drops to 0.
            if (entity.id === this.player.id) {
                this.handleGameOver("Player has been defeated!");
            } else {
                this.eventBus.publish('combatLog', { message: `${entity.name} has been defeated!`, type: "death" });
                this.removeEntity(entity.id);
                if (this.gameMap.getEnemies().length === 0) {
                    this.eventBus.publish('combatLog', { message: "All enemies defeated!", type: "event" });
                }
            }
        });
        this.eventBus.subscribe('intentsDeclared', () => {
            this.startNewRound();
        });
        this.eventBus.subscribe('moveCompleted', ({ entityId, finalHex }) => {
            this._checkTileForAutomaticInteractions(this.getEntity(entityId));
        });
    }

    addEventListeners() {
        const mapSvg = document.getElementById(this.canvasId);
        if (mapSvg) {
            mapSvg.addEventListener('click', this.clickHandler);
            mapSvg.addEventListener('mousemove', this._throttledMouseMove);
            mapSvg.addEventListener('contextmenu', this.rightClickHandler);
        } else {
            console.error(`[Game] FAILED to add event listeners: SVG element #${this.canvasId} not found.`);
        }
    }

    /**
     * Removes event listeners from the map SVG element.
     * This is crucial to prevent duplicate listeners when transitioning maps.
     */
    removeEventListeners() {
        const mapSvg = document.getElementById(this.canvasId);
        if (mapSvg) {
            mapSvg.removeEventListener('click', this.clickHandler);
            mapSvg.removeEventListener('mousemove', this._throttledMouseMove);
            mapSvg.removeEventListener('contextmenu', this.rightClickHandler);
        }
    }

    handleClick(event) {
        if (this.gameState.currentTurn !== 'player' || this.gameState.isGameOver || this.gameState.isAnimating) return;
        const clickedHex = this._getHexFromEvent(event);
        if (clickedHex) {
            this.eventBus.publish('mapClicked', { clickedHex });
        }
    }

    handleRightClick(event) {
        event.preventDefault();
        if (this.gameState.currentTurn !== 'player' || this.gameState.isGameOver || this.gameState.isAnimating) return;
        this.eventBus.publish('mapRightClicked', { event });
    }

    handleMouseMove(event) {
        if (this.gameState.isGameOver) return;
        const currentHoveredHex = this._getHexFromEvent(event);
        if (!this._areHexesEqual(this._lastHoveredHex, currentHoveredHex)) {
            this._lastHoveredHex = currentHoveredHex;
            this.eventBus.publish('mouseMovedOnMap', { hoveredHex: currentHoveredHex });
        }
    }
    
    _getHexFromEvent(event) {
        const mapSvg = document.getElementById(this.canvasId);
        if (!mapSvg || !this.layout || !this.gameMap) return null;
        const pt = mapSvg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const svgP = pt.matrixTransform(mapSvg.getScreenCTM().inverse());
        const fractionalHex = this.layout.pixelToHex(new Point(svgP.x, svgP.y));
        return this.gameMap.getTile(fractionalHex.round().q, fractionalHex.round().r);
    }

    initializeEntities(mapConfig) {
        // This method now initializes all entities placed on the map.
        const allEntities = this.gameMap.entities.values();

        for (const entity of allEntities) {
            let startPos = null;
            if (entity.id === this.player.id) {
                startPos = mapConfig.playerStart;
            } else if (entity.initialCoords) { // All other entities should have initialCoords from map config
                startPos = entity.initialCoords;
            }

            if (startPos) {
                entity.hex = this.gameMap.getTile(startPos.q, startPos.r); // Set hex reference
            } else {
                console.warn(`[Game] Entity ${entity.name} (${entity.id}) has no initial coordinates. This might be intentional for some entities.`);
            }
            
            entity.initComponents();
        }
    }

    /**
     * A generic helper to create a list of entities from the map configuration.
     * @param {object} mapConfig - The configuration for the current map.
     * @param {string} entityCategory - The key for the entity list (e.g., 'enemies', 'traps').
     * @returns {Entity[]} An array of created Entity instances.
     * @private
     */
    _createEntitiesFromConfig(mapConfig, entityCategory) {
        return (mapConfig.entities?.[entityCategory] || []).map(config =>
            this.entityFactory.createEntity(config.type, { q: config.q, r: config.r }, config)
        ).filter(Boolean);
    }
    startNewRound() {
        if (this.gameState.isGameOver) return;
        this.gameState.currentTurn = 'player';
        this.player?.getComponent('stats')?.resetAP();
        this.eventBus.publish('turnStarted', {
            turnNumber: this.gameState.turnNumber++,
            currentTurn: this.gameState.currentTurn
        });
    }

    async resolveEntityAction(payload = {}) {
        if (this.gameState.isGameOver || !payload?.type || this.gameState.isAnimating) return false;
        const actor = this.getEntity(payload.sourceId);
        if (!actor) return false;

        // Log the action if it's from the player.
        if (actor.type === 'player') {
            // We need a serializable version of the payload.
            // The payload contains object references (like targetTile).
            const serializablePayload = this._serializeActionPayload(payload);
            this.replayLog.push(serializablePayload);
        }

        this.gameState.isAnimating = true;
        let actionResolvedSuccessfully = false;
        try {
            switch (payload.type) {
                case 'move':
                    actionResolvedSuccessfully = await this.resolveMoveAction(actor, payload.details);
                    break;
                case 'attack':
                    actionResolvedSuccessfully = this.resolveAttackAction(actor, payload.details);
                    break;
                case 'interactWithEntity':
                    actionResolvedSuccessfully = await this.resolveInteraction(actor, payload.details);
                    break;
                case 'skill': // Skill execution is now handled here with specific logic
                    actionResolvedSuccessfully = await this.resolveSkillAction(actor, payload.details);
                    break;
            }
            if (actor === this.player) {
                this.checkPlayerTurnConditions();
            }
        } catch (error) {
            console.error("[Game] Error during action resolution:", error);
            actionResolvedSuccessfully = false;
        } finally {
            this.gameState.isAnimating = false;
        }

        return actionResolvedSuccessfully;
    }

    /**
     * Converts an action payload with object references to a serializable version.
     * @private
     */
    _serializeActionPayload(payload) {
        const serializable = JSON.parse(JSON.stringify(payload)); // Deep copy to be safe
        if (payload.details.targetTile) {
            serializable.details.targetCoords = { 
                q: payload.details.targetTile.q, 
                r: payload.details.targetTile.r 
            };
            delete serializable.details.targetTile;
        }
        return serializable;
    }

    /**
     * Resolves an interaction action with a target entity.
     * This method now checks for specific interaction components (Trap, Interactable, Portal)
     * and delegates to their respective `activate` or `interact` methods.
     * @param {Entity} actor - The entity performing the interaction.
     * @param {object} details - Details about the interaction, including targetId.
     * @returns {boolean} True if the interaction was resolved, false otherwise.
     */
    async resolveInteraction(actor, details) {
        if (!actor || !details?.targetId) return false;
        const target = this.getEntity(details.targetId);
        if (!target) {
            this.eventBus.publish('combatLog', { message: "Interaction target not found.", type: "warning" });
            return false;
        }

        // Check if the target is a trap
        const trapComp = target.getComponent('trap');
        if (trapComp) {
            // Traps are usually triggered by movement onto their tile, not direct interaction.
            // However, if you want to allow "disarming" or "inspecting" traps, this is where you'd add that.
            this.eventBus.publish('combatLog', { message: `You cannot directly interact with the ${target.name}.`, type: "info" });
            return false;
        }

        // If the target is concealed, it cannot be interacted with directly until detected.
        if (target.isConcealed) {
            this.eventBus.publish('combatLog', { message: `You cannot interact with a concealed ${target.name}.`, type: "warning" });
            return false;
        }

        // Check if the target is a generic interactable (like a campfire)
        const interactableComp = target.getComponent('interactable');
        if (interactableComp) {
            // For direct interaction, the actor must be on the same tile or adjacent.
            if (actor.hex.equals(target.hex) || actor.hex.distance(target.hex) <= 1) {
                interactableComp.interact(actor);
                return true;
            } else {
                this.eventBus.publish('combatLog', { message: `You are too far to interact with the ${target.name}.`, type: "warning" });
                return false;
            }
        }

        // Check if the target is a portal (PortalComponent extends InteractableComponent)
        const portalComp = target.getComponent('portal');
        if (portalComp) {
            // If the actor is already on the portal, trigger it immediately.
            if (actor.hex.equals(target.hex)) {
                portalComp.interact(actor); // PortalComponent's interact will publish mapTransitionRequest
                return true;
            }

            // Otherwise, treat this as an intent to move onto the portal tile.
            const movement = actor.getComponent('movement');
            const effectiveMovementRange = movement?.getEffectiveMovementRange() || 0;
            const path = this._findPath(actor, target.hex);

            if (path && (path.length - 1) <= effectiveMovementRange) {
                // The path is valid and affordable. Let resolveMoveAction handle the AP cost and execution.
                return await this.resolveMoveAction(actor, { targetTile: target.hex });
            }

            this.eventBus.publish('combatLog', { message: "Cannot reach the portal.", type: "warning" });
            return false;
        }

        // If it's none of the above, and it has stats, assume it's an attackable entity
        // This is the fallback for enemies or other attackable objects.
        if (target.hasComponent('stats') && target.getComponent('stats').isAlive()) {
            const stats = actor.getComponent('stats');
            const attackRange = stats.attackRange || 1;

            if (actor.hex.distance(target.hex) <= attackRange) {
                return this.resolveAttackAction(actor, { targetId: target.id });
            }

            const movement = actor.getComponent('movement');
            const effectiveMovementRange = movement?.getEffectiveMovementRange() || 0;
            const { path, targetTile: moveTargetHex, pathLength } = this._findPathToAdjacent(actor, target.hex, effectiveMovementRange);

            if (path && moveTargetHex && pathLength <= effectiveMovementRange) {
                const totalCost = (this.CONFIG.actions.moveCost * pathLength) + this.CONFIG.actions.attackCost;
                if (stats.canAfford(totalCost)) {
                    const moveSuccessful = await this.resolveMoveAction(actor, { targetTile: moveTargetHex });
                    if (moveSuccessful && actor.hex.distance(target.hex) <= attackRange) {
                        return this.resolveAttackAction(actor, { targetId: target.id });
                    }
                }
            } else {
                this.eventBus.publish('combatLog', { message: "Not enough AP to move and attack.", type: "warning" });
            }
        } else {
            this.eventBus.publish('combatLog', { message: "Cannot reach an attack position near that target.", type: "warning" });
        }
        // If no specific interaction or attack was resolved
        this.eventBus.publish('combatLog', { message: `Cannot interact with ${target.name}.`, type: "warning" });
        return false;
    }

    /**
     * Handles requests to transition to a new map.
     * @param {string} nextMapId - The ID of the map to load.
     * @param {string} entityId - The ID of the entity (usually player) transitioning.
     */
    async handleMapTransition(nextMapId, entityId) {
        // If there's no next map, the dungeon is complete.
        if (!nextMapId) {
            this.handleGameOver("Dungeon Completed!");
            return;
        }

        const entity = this.getEntity(entityId);
        if (!entity || entity.type !== 'player') {
            console.error(`[Game] Non-player entity ${entityId} tried to transition.`);
            return;
        }

        // Preserve the player entity instance to carry over its state
        const playerToPreserve = this.player;

        // 1. Clean up the state of the current map.
        this._cleanupForTransition();

        // Update the character data to reflect the new map
        this.characterData.currentMapId = nextMapId;

        // 2. Re-initialize the game with the new map configuration.
        await this.initializeLayoutAndMap(this.characterData, playerToPreserve);
    }

    /**
     * Resets the game state in preparation for loading a new map.
     * @private
     */
    _cleanupForTransition() {
        this.removeEventListeners();
        this.layout = null;
        this.gameMap = null;
        this._intentsPrimed = false;
        // The renderer will be recreated in initializeLayoutAndMap, which handles clearing the SVG.
    }

    async resolveSkillAction(actor, details) {
        const { skillId, targetHex, targetId } = details;
        const skillsComponent = actor.getComponent('skills');
        const statsComponent = actor.getComponent('stats');
        if (!skillsComponent || !statsComponent) return false;

        const skill = skillsComponent.getSkill(skillId);
        if (!skill || !skillsComponent.canUseSkill(skillId)) {
            this.eventBus.publish('combatLog', { message: `Cannot use ${skill.name}.`, type: 'warning' });
            return false;
        }
        
        // --- Generic Skill Effect Execution ---
        statsComponent.spendActionPoints(skill.apCost || 0);
        statsComponent.spendManaPoints(skill.mpCost || 0);
        skillsComponent.startCooldown(skillId);
        this.eventBus.publish('combatLog', { message: `${actor.name} uses ${skill.name}!`, type: 'skill' });

        // The new generic resolver loop
        for (const effect of skill.effects) {
            // Movement is a special case that targets the actor and a hex, not a list of entities.
            if (effect.type === 'movement') {
                await this.resolveMovementEffect(actor, targetHex, effect);
                continue;
            }

            // For all other effects, determine the target(s) for this specific effect
            const targets = this._getTargetsForEffect(actor, targetHex, effect);

            // Resolve the effect for each target
            for (const currentTarget of targets) {
                switch (effect.type) {
                    case 'damage':
                        this.resolveDamageEffect(actor, currentTarget, effect);
                        break;
                    case 'apply_status':
                        this.resolveApplyStatusEffect(currentTarget, effect);
                        break;
                    case 'custom_script':
                        // This is the "escape hatch" for very complex, unique skills.
                        console.warn(`[Game] Custom script effect "${effect.scriptId}" not yet implemented.`);
                        break;
                    default:
                        console.warn(`[Game] Unknown effect type: ${effect.type}`);
                }
            }
        }

        return true; // The skill and its effects have been processed
    }

    _getTargetsForEffect(actor, primaryTargetHex, effect) {
        // This helper determines who the effect applies to
        switch (effect.target) {
            case 'self':
                return [actor];
            case 'target_hex':
                const entity = this.gameMap.getEntityAt(primaryTargetHex.q, primaryTargetHex.r);
                return entity ? [entity] : [];
            case 'aoe_at_target_hex':
                const radius = effect.splashRadius || 0;
                const tilesInArea = this.gameMap.getTilesInRange(primaryTargetHex, radius);
                return tilesInArea.map(tile => this.gameMap.getEntityAt(tile.q, tile.r)).filter(Boolean);
            default:
                console.warn(`[Game] Unknown effect target type: ${effect.target}`);
                return [];
        }
    }

    resolveDamageEffect(source, target, effect) {
        // Reads damage parameters from the effect object
        const baseDamage = effect.baseAmount || source.getComponent('stats').attackPower;
        const multiplier = effect.multiplier || 1.0;
        const finalDamage = Math.floor(baseDamage * multiplier);

        target.getComponent('stats').takeDamage(finalDamage);
        this.eventBus.publish('combatLog', { message: `${source.name}'s ${effect.damageType || 'attack'} hits ${target.name} for ${finalDamage} damage!`, type: 'damage' });
    }

    resolveApplyStatusEffect(target, effect) {
        if (this.statusEffectSystem && effect.statusId) {
            this.statusEffectSystem.applyStatus({
                targetId: target.id,
                effectId: effect.statusId,
                durationOverride: effect.duration
            });
        }
    }

    async resolveMovementEffect(actor, targetHex, effect) {
        const movementComp = actor.getComponent('movement');
        if (movementComp && effect.moveType === 'teleport') {
            // For teleport, path is just start and end
            await movementComp.moveTo([actor.hex, targetHex]);
        }
    }

    resolveAttackAction(actor, details) {
        const stats = actor.getComponent('stats');
        if (!stats || !details?.targetId) return false;
        const target = this.getEntity(details.targetId);
        if (!target || !target.getComponent('stats')?.isAlive()) return false;

        if (actor.type === 'player' && !stats.canAfford(this.CONFIG.actions.attackCost)) {
            this.eventBus.publish('combatLog', { message: "Not enough AP to attack!", type: "warning" });
            return false;
        }
        if (actor.hex.distance(target.hex) > (stats.attackRange || 1)) {
            this.eventBus.publish('combatLog', { message: "Target is out of range!", type: "warning" });
            return false;
        }

        if (actor.type === 'player') stats.spendActionPoints(this.CONFIG.actions.attackCost);
        const damage = stats.attackPower || 5;
        target.getComponent('stats').takeDamage(damage);
        this.eventBus.publish('combatLog', { message: `${actor.name} attacks ${target.name} for ${damage} damage!`, type: "info" });
        return true;
    }

    async resolveMoveAction(actor, details) {
        if (!actor || !details?.targetTile) return false;
        const targetTile = this.gameMap.getTile(details.targetTile.q, details.targetTile.r);
        if (!targetTile) return false;

        const movementComp = actor.getComponent('movement');
        const path = this._findPath(actor, targetTile);
        const stats = actor.getComponent('stats');
        const maxMovement = movementComp?.getEffectiveMovementRange() || 0;
        
        if (!path || (path.length - 1) > maxMovement) {
            this.eventBus.publish('combatLog', { message: "Cannot move there.", type: 'warning' });
            return false;
        }

        const moveCost = this.CONFIG.actions.moveCost * (path.length - 1);
        if (actor.type === 'player' && !stats.canAfford(moveCost)) {
            this.eventBus.publish('combatLog', { message: "Not enough AP to move!", type: "warning" });
            return false;
        }

        if (movementComp) {
            const movePromise = movementComp.moveTo(path);
            if (actor.type === 'player') stats.spendActionPoints(moveCost);
            await movePromise;
        } else {
            // Fallback if no MovementComponent, just update hex directly
            actor.hex = targetTile;
            actor.getComponent('renderable')?.updatePosition();
            if (actor.type === 'player') stats.spendActionPoints(moveCost);
        }
        
        return true;
    }

    /**
     * Checks if an entity has entered a tile with an entity that triggers on entry (e.g., trap, portal)
     * and activates its effect.
     * This should be called after an entity moves to a new hex.
     * @param {Entity} entity - The entity that just moved.
     * @private
     */
    _checkTileForAutomaticInteractions(entity) {
        if (!entity) return;
        const tile = entity.hex;
        const entitiesOnTile = this.gameMap.getEntitiesAt(tile.q, tile.r);

        for (const otherEntity of entitiesOnTile) {
            if (otherEntity.id === entity.id) continue; // Don't interact with self

            // Check for traps
            if (otherEntity.hasComponent('trap')) otherEntity.getComponent('trap').activate(entity);

            // Check for portals
            // This triggers the map transition automatically when the player lands on the portal tile.
            if (otherEntity.hasComponent('portal') && entity.type === 'player') {
                otherEntity.getComponent('portal').interact(entity);
            }
        }
    }

    _findPath(actor, endTile) {
        if (!actor || !actor.hex || !endTile) return null; // Prevent crash if actor has no position

        this.gameMap.resetPathfindingData();
        const openSet = new Set([actor.hex]);
        actor.hex.gScore = 0;
        actor.hex.fScore = actor.hex.distance(endTile);

        while (openSet.size > 0) {
            let current = [...openSet].reduce((a, b) => a.fScore < b.fScore ? a : b);

            if (current.equals(endTile)) return this._reconstructPath(current);

            openSet.delete(current);

            for (const neighbor of this.gameMap.getWalkableNeighbors(current)) {
                // The getWalkableNeighbors method already ensures we can move here.
                // The redundant check that was here was buggy and has been removed.

                const tentativeGScore = current.gScore + 1;
                if (tentativeGScore < neighbor.gScore) {
                    neighbor.cameFrom = current;
                    neighbor.gScore = tentativeGScore;
                    neighbor.fScore = neighbor.gScore + neighbor.distance(endTile);
                    if (!openSet.has(neighbor)) openSet.add(neighbor);
                }
            }
        }
        return null;
    }

    _reconstructPath(currentTile) {
        const totalPath = [currentTile];
        while (currentTile.cameFrom) {
            totalPath.unshift(currentTile.cameFrom);
            currentTile = currentTile.cameFrom;
        }
        return totalPath;
    }

    _findPathToAdjacent(playerEntity, targetEntityHex, maxMoveRange) {
        const neighborsOfTarget = this.gameMap.getRawNeighbors(targetEntityHex).filter(n => n && !n.isObstacle);
        let bestPath = null, shortestPathLength = Infinity, bestTargetTileForMove = null;

        for (const adjacentHex of neighborsOfTarget) {
            // Correctly check if the adjacent hex is blocked by an entity that blocks movement
            const entitiesOnAdjacent = this.gameMap.getEntitiesAt(adjacentHex.q, adjacentHex.r);
            const isBlockedByOtherEntity = entitiesOnAdjacent.some(e => e.blocksMovement && e.id !== playerEntity.id);

            if (isBlockedByOtherEntity) {
                // If the tile is blocked by another entity, we cannot move there.
                continue;
            }
            
            const path = this._findPath(playerEntity, adjacentHex);
            if (path) {
                const currentPathLength = path.length - 1;
                if (currentPathLength <= maxMoveRange && currentPathLength < shortestPathLength) {
                    shortestPathLength = currentPathLength;
                    bestPath = path;
                    bestTargetTileForMove = adjacentHex;
                }
            }
        }
        return { path: bestPath, targetTile: bestTargetTileForMove, pathLength: shortestPathLength };
    }

    getEntity(entityId) {
        if (this.player?.id === entityId) return this.player;
        return this.gameMap?.entities.get(entityId) || null;
    }

    /**
     * Creates a serializable representation of the current game state for validation.
     * The structure of this object MUST match the structure produced by the server's GameEngine.
     * @returns {Object} A JSON-friendly object representing the game state.
     */
    getSerializableState() {
        // Get the full, savable state of the player's stats.
        const playerState = this.player.getComponent('stats').getSavableStats();
        const enemies = this.gameMap.getEnemies().map(enemy => {
            const enemyStats = enemy.getComponent('stats');
            return {
                x: enemy.hex.col,
                y: enemy.hex.row,
                health: enemyStats.hp,
                attack_power: enemyStats.attackPower
            };
        });

        return { player: playerState, enemies: enemies };
    }

    removeEntity(entityId) {
        const enemy = this.getEntity(entityId);
        if (enemy) {
            enemy.destroy();
            this.gameMap.removeEntity(enemy);
        }
    }

    handleGameOver(message) {
        if (this.gameState.isGameOver) return;
        this.gameState.setGameOver(true);
        this.eventBus.publish('gameOver', {
            message: message,
            score: this.player?.getComponent('stats')?.xp || 0,
            characterData: this.characterData,
            replayData: { sessionId: this.sessionId, replayLog: this.replayLog }
        });
    }

    endPlayerTurn() {
        if (this.gameState.currentTurn !== 'player' || this.gameState.isGameOver) return;
        this.gameState.currentTurn = 'enemies';
        this.eventBus.publish('playerTurnEnded');
    }

    checkPlayerTurnConditions() {
        if (!this.player?.getComponent('stats')?.isAlive()) {
            this.handleGameOver("Player has been defeated!");
        } else if (this.player?.getComponent('stats')?.getCurrentAP() <= 0) {
            this.endPlayerTurn();
        }
    }

    setIntentSystem(intentSystem) {
        this.intentSystem = intentSystem;
        // The initial generation of intents is now handled at the end of initializeLayoutAndMap.
    }

    setDetectionSystem(detectionSystem) { this.detectionSystem = detectionSystem; } // New: Setter for DetectionSystem
    setStatusEffectSystem(statusEffectSystem) { this.statusEffectSystem = statusEffectSystem; }
    setVisibilitySystem(visibilitySystem) { this.visibilitySystem = visibilitySystem; }

    _areHexesEqual(hexA, hexB) {
        if (hexA === hexB) return true;
        if (!hexA || !hexB) return false;
        return hexA.equals(hexB);
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    start() { /* ... game loop logic ... */ }
}