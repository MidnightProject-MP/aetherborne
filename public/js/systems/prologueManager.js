/**
 * Manages the state and flow of the game's prologue by listening to game events
 * and publishing narration requests to the event bus.
 * @class PrologueManager
 */
class PrologueManager {
    /**
     * @param {object} eventBus - The global event bus instance.
     * @param {object} config - The global CONFIG object containing prologue scripts.
     */
    constructor(eventBus, config) {
        if (!eventBus || !config) {
            throw new Error("PrologueManager requires an EventBus and a Config object.");
        }

        /** @private */
        this.eventBus = eventBus;
        /** @private */
        this.config = config;
        /** @private */
        this.currentNarrationQueue = [];

        this.initialize();
    }

    /**
     * Subscribes the manager to all relevant global events.
     * @private
     */
    initialize() {
        this.eventBus.subscribe('mapLoaded', (payload) => this.handleMapLoad(payload.mapId));
        console.log("PrologueManager initialized and listening for 'mapLoaded' events.");
    }

    /**
     * Handles the 'mapLoaded' event to check for and queue up prologue scripts.
     * @param {string} mapId - The ID of the map that was just loaded.
     * @private
     */
    handleMapLoad(mapId) {
        const script = this.config.prologueScripts?.[mapId];
        if (script?.onLoad) {
            this.currentNarrationQueue = [...script.onLoad]; // Create a new queue from the script
            this._showNextNarration();
        }
    }

    /**
     * Publishes a 'showNarration' event for the next message in the queue.
     * The OverlayManager is responsible for catching this event and displaying the UI.
     * @private
     */
    _showNextNarration() {
        if (this.currentNarrationQueue.length === 0) return;

        const narrationStep = this.currentNarrationQueue.shift();

        if (narrationStep.type === 'narration') {
            this.eventBus.publish('showNarration', {
                message: narrationStep.message,
                // The callback now simply calls the next step, keeping the logic here.
                actions: [{ label: 'Continue', callback: () => this._showNextNarration() }]
            });
        }
    }
}

export default PrologueManager;
