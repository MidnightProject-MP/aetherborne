/**
 * Stores the "true" intent data for an entity for the current turn.
 * This acts as a simple data container.
 * @class IntentComponent
 */
class IntentComponent {
    constructor() {
        this.name = 'intent';
        /** @type {Entity|null} */
        this.entity = null;
        
        /** * The generated IntentData object for the current turn.
         * @private
         * @type {{
         *   type: string,
         *   actorId: string,
         *   targetType: 'tile' | 'entity' | null, // null for self-target or no target
         *   targetValue: {q: number, r: number} | string | null, // tile coords or entity ID
         *   skillId?: string, // Optional: for skill-based intents
         *   cost?: number | object, // Optional: AP cost or other resource costs
         *   clarity?: string // Optional: for UI display
         * } | null} 
         */
        this.currentIntent = null;
    }

    /**
     * Sets the intent for the current turn.
     * @param {object} intentData - The full intent data object.
     */
    setCurrentIntent(intentData) {
        this.currentIntent = intentData;
    }

    /**
     * Retrieves the intent for the current turn.
     * @returns {object|null}
     */
    getCurrentIntent() {
        return this.currentIntent;
    }

    /**
     * Clears the intent at the end of a turn.
     */
    clearIntent() {
        this.currentIntent = null;
    }
}

export default IntentComponent;
