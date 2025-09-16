import { Tile } from '../tile.js'; // Assuming Tile class is available for coordinate conversion
import { lerp } from '../utils.js';

/**
 * @class SVGRenderer
 * Manages all visual rendering onto the main game SVG element.
 * This system is responsible for creating, updating, and removing SVG elements
 * for the map, entities, UI, and temporary overlays.
 */
class SVGRenderer {
    /**
     * @param {object} eventBus - The global event bus instance.
     * @param {object} game - A reference to the main game instance.
     * @param {string} svgElementId - The ID of the main SVG element (e.g., 'game-map-svg').
     */
    constructor(eventBus, game, svgElementId) {
        if (!eventBus || !game || !svgElementId) {
            throw new Error("SVGRenderer requires an EventBus, Game instance, and SVG element ID.");
        }

        this.eventBus = eventBus;
        this.game = game;
        this.svgElement = document.getElementById(svgElementId);
        if (!this.svgElement) {
            throw new Error(`SVG element with ID '${svgElementId}' not found.`);
        }

        // Get references to specific SVG layers
        this.layers = {
            map: this.svgElement.querySelector('#map-layer'),
            fog: this.svgElement.querySelector('#fog-layer'),
            entities: this.svgElement.querySelector('#entity-layer'),
            entityUI: this.svgElement.querySelector('#entity-ui-layer'),
            rangePreview: this.svgElement.querySelector('#range-preview-layer'),
            pathPreview: this.svgElement.querySelector('#path-preview-layer'),
            effectPreview: this.svgElement.querySelector('#effect-preview-layer'),
            // Add more layers as needed (e.g., combat text, particles)
        };

        // Ensure all critical layers exist
        for (const key in this.layers) {
            if (!this.layers[key]) {
                console.warn(`SVG layer #${key}-layer not found. Please ensure it's defined in your SVG structure.`);
                // Optionally create them if they don't exist, but better to define in HTML
            }
        }

        // Internal maps for managing elements
        this.entityElements = new Map(); // Map<entityId, SVGElement>
        this.tileElements = new Map();   // Map<tileKey (q,r), SVGElement>
        this.fowElements = new Map();    // Map<tileKey (q,r), SVGElement> for FOW covers
        this.activeAnimations = new Map(); // Map<entityId, animationState>
        this.listeners = new Map(); // To track event listeners for easy removal

        this._setupEventListeners();
        this.clearAllPreviews(); // Clear any initial previews
    }

    /**
     * A helper to bind and store event listeners for easy removal later.
     * @param {string} event - The name of the event.
     * @param {function} callback - The callback function to execute.
     * @private
     */
    _addListener(event, callback) {
        const boundCallback = callback.bind(this);
        this.listeners.set(event, boundCallback);
        this.eventBus.subscribe(event, boundCallback);
    }

    /**
     * Subscribes the renderer to relevant game events.
     * @private
     */
    _setupEventListeners() {
        this._addListener('mapLoaded', this.renderFullMap);
        this._addListener('visibilityUpdated', this.updateMapVisibility);
        this._addListener('entityMoved', (payload) => this.updateEntityPosition(payload.entityId));
        this._addListener('entityCreated', (payload) => this.addEntityToRender(payload.entity));
        this._addListener('entityRemoved', (payload) => this.removeEntityFromRender(payload.entityId));
        this._addListener('intentsDeclared', this.updateEnemyIntents);
        this._addListener('entityHealthChanged', (payload) => this.updateHealthBar(payload.entityId));
        this._addListener('statusEffectApplied', (payload) => this.addStatusEffectIcon(payload.entityId, payload.effect));
        this._addListener('entityVisibilityChanged', (payload) => this.updateEntityVisibility(payload.entityId, payload.isVisible));
        this._addListener('statusEffectExpired', (payload) => this.removeStatusEffectIcon(payload.entityId, payload.effects));
        this._addListener('entityAnimateMove', this._handleAnimationRequest);
    }

    /**
     * Unsubscribes all event listeners and cleans up the renderer.
     */
    destroy() {
        console.log('[SVGRenderer] Destroying and unsubscribing from events.');
        for (const [event, callback] of this.listeners.entries()) {
            this.eventBus.unsubscribe(event, callback);
        }
        this.svgElement.innerHTML = ''; // Clear all layers
    }

    /**
     * Converts game world coordinates (q, r) to SVG screen coordinates (x, y).
     * @param {Tile} hex - The hexagonal coordinate object.
     * @returns {{x: number, y: number}} The screen coordinates.
     */
    _hexToScreen(hex) {
        if (!hex || !this.game.layout) {
            // console.warn("[SVGRenderer] _hexToScreen called with invalid hex or layout.");
            return { x: -9999, y: -9999 }; // Return off-screen coords to avoid errors
        }
        return this.game.layout.hexToPixel(hex);
    }

    /**
     * Clears all temporary preview overlays.
     */
    clearAllPreviews() {
        this.clearRangePreview();
        this.clearPathPreview();
        this.clearEffectPreview();
    }

    /**
     * Clears the range preview layer.
     */
    clearRangePreview() {
        if (this.layers.rangePreview) this.layers.rangePreview.innerHTML = '';
    }

    /**
     * Clears the path preview layer.
     */
    clearPathPreview() {
        if (this.layers.pathPreview) this.layers.pathPreview.innerHTML = '';
    }

    /**
     * Clears the effect preview layer.
     */
    clearEffectPreview() {
        if (this.layers.effectPreview) this.layers.effectPreview.innerHTML = '';
    }

    /**
     * Draws a range preview on the map.
     * @param {object} payload - The payload containing tiles and layout.
     * @param {Array<Tile>} payload.tiles - Array of Tile coordinates to highlight.
     * @param {string} [payload.overrideClassName] - Optional CSS class to apply.
     */
    showRangePreview({ tiles, overrideClassName = 'preview-tile' }) {
        this.clearRangePreview();
        if (!this.layers.rangePreview) return;

        const polygonPoints = this.game.layout.polygonPoints;
        tiles.forEach(hex => {
            const { x, y } = this._hexToScreen(hex);
            const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            polygon.setAttribute("points", polygonPoints);
            polygon.setAttribute("transform", `translate(${x}, ${y})`);
            polygon.setAttribute("class", overrideClassName);
            this.layers.rangePreview.appendChild(polygon);
        });
    }

    /**
     * Draws a path preview on the map.
     * @param {object} payload - The payload containing tiles and layout.
     * @param {Array<Tile>} payload.tiles - Array of Tile coordinates forming the path.
     */
    showPathPreview({ tiles }) {
        this.clearPathPreview();
        if (!this.layers.pathPreview || !tiles) return;

        const polygonPoints = this.game.layout.polygonPoints;
        tiles.forEach(hex => {
            const { x, y } = this._hexToScreen(hex);
            const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            polygon.setAttribute("points", polygonPoints);
            polygon.setAttribute("transform", `translate(${x}, ${y})`);
            polygon.setAttribute("class", "preview-tile path-preview"); // Use a specific class
            this.layers.pathPreview.appendChild(polygon);
        });
    }

    /**
     * Draws an effect preview on the map.
     * @param {object} payload - The payload containing tiles and layout.
     * @param {Array<Tile>} payload.tiles - Array of Tile coordinates for the effect area.
     */
    showEffectPreview({ tiles }) {
        this.clearEffectPreview();
        if (!this.layers.effectPreview || !tiles) return;

        const polygonPoints = this.game.layout.polygonPoints;
        tiles.forEach(hex => {
            const { x, y } = this._hexToScreen(hex);
            const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            polygon.setAttribute("points", polygonPoints);
            polygon.setAttribute("transform", `translate(${x}, ${y})`);
            polygon.setAttribute("class", "preview-tile effect-preview"); // Use a specific class
            this.layers.effectPreview.appendChild(polygon);
        });
    }

    // Placeholder methods for core rendering logic (to be implemented)
    /**
     * Renders the entire game map, including tiles and all initial entities.
     * This is typically called once when a new map is loaded.
     */
    renderFullMap() {
        console.log("[SVGRenderer] Rendering full map...");
        if (!this.layers.map || !this.layers.fog || !this.layers.entities) {
            console.error("[SVGRenderer] Critical layer (map, fog, or entities) not found for full render.");
            return;
        }

        // Clear existing map and entity elements
        this.layers.map.innerHTML = '';
        this.layers.fog.innerHTML = '';
        this.layers.entities.innerHTML = '';
        this.tileElements.clear();
        this.entityElements.clear();

        const gameMap = this.game.gameMap;
        const layout = this.game.layout;
        const polygonPoints = layout.polygonPoints;

        // Render Tiles
        gameMap.getAllTiles().forEach(tile => {
            const { x, y } = this._hexToScreen(tile);
            const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            polygon.setAttribute("points", polygonPoints);
            polygon.setAttribute("transform", `translate(${x}, ${y})`);
            polygon.setAttribute("class", `map-tile ${tile.isObstacle ? 'obstacle' : ''} ${tile.isPortal ? 'portal' : ''}`);
            polygon.dataset.q = tile.q;
            polygon.dataset.r = tile.r;
            this.layers.map.appendChild(polygon);
            this.tileElements.set(`${tile.q},${tile.r}`, polygon);

            // Create a corresponding cover polygon on the FOW layer
            const fowCover = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            fowCover.setAttribute("points", polygonPoints);
            fowCover.setAttribute("transform", `translate(${x}, ${y})`);
            fowCover.setAttribute("class", "fow-cover fow-hidden"); // Start hidden
            this.layers.fog.appendChild(fowCover);
            this.fowElements.set(`${tile.q},${tile.r}`, fowCover);
        });
        console.log(`[SVGRenderer] Rendered ${this.tileElements.size} tiles.`);

        // Render Entities
        // Iterate through gameMap.entities (which is a Map<id, entity>)
        for (const entity of gameMap.entities.values()) {
            this.addEntityToRender(entity);
        }
        console.log(`[SVGRenderer] Rendered ${this.entityElements.size} entities.`);

        // Initial visibility update (Fog of War)
        this.updateMapVisibility();
    }

    /**
     * Updates the visibility of map tiles and entities based on Fog of War.
     */
    updateMapVisibility() {
        const gameMap = this.game.gameMap;
        gameMap.getAllTiles().forEach(tile => {
            const fowElement = this.fowElements.get(`${tile.q},${tile.r}`);
            if (fowElement) {
                // Update the FOW cover's class instead of the tile itself
                fowElement.classList.remove('fow-hidden', 'fow-partial', 'fow-full');
                fowElement.classList.add(`fow-${tile.visibility}`);
            }

            // Update visibility for entities on this tile
            const entitiesOnTile = gameMap.getEntitiesAt(tile.q, tile.r);
            entitiesOnTile.forEach(entity => {
                // Entities are only visible if their tile is 'full' visibility AND they are not concealed
                const isVisible = tile.visibility === 'full' && !entity.isConcealed;
                this.updateEntityVisibility(entity.id, isVisible);
            });
        });
        console.log("[SVGRenderer] Map visibility updated (FoW).");
    }

    /**
     * Adds an entity's visual representation to the SVG.
     * @param {object} entity - The entity object to render.
     */
    addEntityToRender(entity) {
        if (!this.layers.entities || !entity || !entity.getComponent('renderable') || this.entityElements.has(entity.id)) {
            return; // Already rendered or invalid entity
        }

        const renderable = entity.getComponent('renderable');
        const { x, y } = this._hexToScreen(entity.hex);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute('r', renderable.radius.toString());
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('fill', renderable.fillColor);
        circle.setAttribute('class', `${renderable.cssClass} ${entity.type}-visual`);
        circle.dataset.entityId = entity.id;
        circle.style.zIndex = renderable.zIndex;

        this.layers.entities.appendChild(circle);
        this.entityElements.set(entity.id, circle);
        this.updateEntityVisibility(entity.id, !entity.isConcealed); // Set initial visibility based on concealment
        console.log(`[SVGRenderer] Added visual for entity: ${entity.name} (${entity.id})`);
    }

    /**
     * Removes an entity's visual representation from the SVG.
     * @param {string} entityId - The ID of the entity to remove.
     */
    removeEntityFromRender(entityId) {
        const element = this.entityElements.get(entityId);
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
            this.entityElements.delete(entityId);
            console.log(`[SVGRenderer] Removed visual for entity: ${entityId}`);
        }
    }

    /**
     * Updates an entity's visual position on the SVG.
     * @param {string} entityId - The ID of the entity whose position changed.
     */
    updateEntityPosition(entityId) {
        const entity = this.game.getEntity(entityId);
        const element = this.entityElements.get(entityId);
        if (entity && element && entity.hex) {
            const { x, y } = this._hexToScreen(entity.hex);
            element.setAttribute('cx', x);
            element.setAttribute('cy', y);
        }
    }

    /**
     * Updates the visibility (display style) of an entity's visual element.
     * @param {string} entityId - The ID of the entity.
     * @param {boolean} isVisible - True to show, false to hide.
     */
    updateEntityVisibility(entityId, isVisible) {
        const element = this.entityElements.get(entityId);
        if (element) {
            element.style.display = isVisible ? '' : 'none';
        }
    }

    /**
     * Handles a request to animate an entity's movement along a path.
     * @param {object} payload - The animation request payload.
     * @private
     */
    _handleAnimationRequest({ entityId, path, stepDuration, onComplete, onError }) {
        if (this.activeAnimations.has(entityId)) {
            if (onError) onError(new Error(`Animation already in progress for entity ${entityId}`));
            return;
        }

        const element = this.entityElements.get(entityId);
        const entity = this.game.getEntity(entityId);
        if (!element || !entity) {
            if (onError) onError(new Error(`Cannot animate: Entity or element not found for ID ${entityId}`));
            return;
        }

        const animationState = {
            entityId,
            path,
            stepDuration,
            onComplete,
            onError,
            element,
            entity,
            currentStep: 1, // Start with the first step of the path
            animationFrameId: null
        };

        this.activeAnimations.set(entityId, animationState);
        this._animateMovementStep(animationState);
    }

    /**
     * Executes a single step of the movement animation.
     * @param {object} animationState - The state object for the current animation.
     * @private
     */
    _animateMovementStep(animationState) {
        if (animationState.currentStep >= animationState.path.length) {
            this._finalizeAnimation(animationState);
            return;
        }

        const fromTile = animationState.path[animationState.currentStep - 1];
        const toTile = animationState.path[animationState.currentStep];

        const fromPixel = this.game.layout.hexToPixel(fromTile);
        const toPixel = this.game.layout.hexToPixel(toTile);
        const duration = animationState.stepDuration;
        const startTime = performance.now();

        const animateFrame = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1); // Interpolation factor from 0 to 1

            const x = lerp(fromPixel.x, toPixel.x, t);
            const y = lerp(fromPixel.y, toPixel.y, t);

            animationState.element.setAttribute('cx', x);
            animationState.element.setAttribute('cy', y);

            if (t < 1) {
                animationState.animationFrameId = requestAnimationFrame(animateFrame);
            } else {
                animationState.currentStep++;
                this._animateMovementStep(animationState);
            }
        };

        animationState.animationFrameId = requestAnimationFrame(animateFrame);
    }

    /**
     * Finalizes the animation, updates game state, and calls the completion callback.
     * @param {object} animationState - The state object for the completed animation.
     * @private
     */
    _finalizeAnimation(animationState) {
        const { entity, path, onComplete, entityId } = animationState;
        const finalHex = path[path.length - 1];

        entity.hex = finalHex;
        this.updateEntityPosition(entityId);
        this.activeAnimations.delete(entityId);

        const eventPayload = { entityId, finalHex };
        this.game.eventBus.publish('moveCompleted', eventPayload);

        if (onComplete) {
            onComplete({ moved: true, finalHex });
        }
    }

    // Remaining placeholder methods (to be implemented later as needed)
    updateEnemyIntents() { /* ... */ }
    updateHealthBar(entityId) { /* ... */ }
    addStatusEffectIcon(entityId, effect) { /* ... */ }
    removeStatusEffectIcon(entityId, effects) { /* ... */ }
}

export default SVGRenderer;