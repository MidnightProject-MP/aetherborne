/**
 * Defines how an entity reacts to specific game events, such as its own
 * intent being blocked or an ally being attacked.
 * @class ReactionComponent
 */
class ReactionComponent {
    constructor(config = {}) {
        this.name = 'reaction';
        /** @type {Entity|null} */
        this.entity = null;
        
        /** * A list of reaction configurations from config.js.
         * @private
         * @type {object[]} 
         */
        this.reactions = config.reactions || [];
    }

    /**
     * Initializes the component and subscribes to relevant events.
     */
    init() {
        this._setupEventListeners();
    }
    
    /**
     * Subscribes to events that might trigger a reaction.
     * @private
     */
    _setupEventListeners() {
        const eventBus = this.entity.game.eventBus;
        if (!eventBus) return;

        eventBus.subscribe('IntentBlocked', (payload) => this._handleIntentBlocked(payload));
        // Add more listeners for other triggers, e.g., 'allyTookDamage'
    }

    /**
     * Handles the IntentBlocked event to see if this entity should react.
     * @param {object} payload - The event payload.
     * @private
     */
    _handleIntentBlocked({ intent }) {
        // Check if the blocked intent was this entity's own intent
        if (intent.actorId === this.entity.id) {
            // Find a reaction rule for 'on_own_intent_blocked'
            const reactionRule = this.reactions.find(r => r.trigger === 'on_own_intent_blocked');
            if (reactionRule) {
                console.log(`${this.entity.name} reacts to its own blocked intent!`);
                // Execute the reaction effect, e.g., gain a temporary buff
                // this.entity.game.eventBus.publish('applyStatusEffect', ...);
            }
        }
    }
}

export default ReactionComponent;
