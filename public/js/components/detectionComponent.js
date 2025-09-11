/**
 * Manages the detectability of an entity, typically for concealed objects like traps.
 * @class DetectionComponent
 */
class DetectionComponent {
    constructor(config = {}) {
        this.name = 'detection';
        this.entity = null; // Will be set by Entity.addComponent

        /**
         * The difficulty score required to detect this entity.
         * @type {number}
         */
        this.detectionDifficulty = config.detectionDifficulty || 0;

        /**
         * True if the entity has been detected by the player.
         * @type {boolean}
         */
        this.isDetected = false;
    }

    init() {
        // If the entity starts concealed, ensure its visual is hidden.
        // The RenderableComponent already handles this based on entity.isConcealed.
        // This component primarily holds the detection difficulty and state.
    }

    /**
     * Marks the entity as detected and updates its visual.
     */
    reveal() {
        if (!this.isDetected) {
            this.isDetected = true;
            this.entity.isConcealed = false; // Update entity's main concealed flag
            this.entity.getComponent('renderable')?.setVisibility(true);
            this.entity.game.eventBus.publish('combatLog', { message: `You detected a ${this.entity.name}!`, type: 'info' });
        }
    }

    destroy() {
        // Clean up
    }
}

export default DetectionComponent;