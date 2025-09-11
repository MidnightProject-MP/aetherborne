/**
 * Manages the detection of concealed entities (e.g., traps) by the player.
 * @class DetectionSystem
 */
class DetectionSystem {
    constructor(eventBus, game) {
        this.eventBus = eventBus;
        this.game = game;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Trigger detection checks when the player moves or a new turn starts
        this.eventBus.subscribe('moveCompleted', (payload) => {
            if (payload.entityId === this.game.player.id) {
                this.checkDetection();
            }
        });
        this.eventBus.subscribe('turnStarted', (payload) => {
            if (payload.currentTurn === 'player') {
                this.checkDetection();
            }
        });
    }

    /**
     * Performs detection checks for all concealed entities within the player's detection range.
     */
    checkDetection() {
        const player = this.game.player;
        if (!player || !player.hex) return;

        const playerStats = player.getComponent('stats');
        const playerVisibility = player.getComponent('visibility');
        if (!playerStats || !playerVisibility) return;

        // Player's detection score (can be based on Instinct, a dedicated 'detection' stat, etc.)
        // For now, let's use Instinct + a base value.
        const playerDetectionScore = playerStats.attributes.instinct + (this.game.CONFIG.player.baseDetection || 0);

        // Get all entities on the map
        const allEntities = [...this.game.gameMap.entities.values()];

        for (const entity of allEntities) {
            // Only check entities that are:
            // 1. Not the player themselves
            // 2. Currently concealed
            // 3. Have a DetectionComponent
            // 4. Are within the player's partial sight range (or a specific detection range)
            if (entity.id === player.id || !entity.isConcealed || !entity.hasComponent('detection')) {
                continue;
            }

            const detectionComp = entity.getComponent('detection');
            const distance = player.hex.distance(entity.hex);

            // Check if the entity is within the player's detection range (e.g., partial sight range)
            if (distance <= playerVisibility.sightRangePartial) {
                // Perform the detection check
                if (playerDetectionScore >= detectionComp.detectionDifficulty) {
                    detectionComp.reveal(); // This will set entity.isConcealed = false and update visual
                }
            }
        }
    }

    destroy() {
        // Unsubscribe from events if necessary
    }
}

export default DetectionSystem;