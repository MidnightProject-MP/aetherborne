/**
 * Represents a skill instance with its static properties from the configuration
 * and its dynamic state during gameplay (e.g., cooldowns).
 * This class acts as a data container.
 * @class Skill
 */
class Skill {
    /**
     * Creates a skill instance from a configuration object.
     * @param {object} skillConfig - The configuration object for the skill from CONFIG.skills.
     */
    constructor(skillConfig) {
        if (!skillConfig?.id || !skillConfig?.name) {
            throw new Error("Skill configuration must include at least an id and a name.");
        }

        /** @type {string} The unique identifier for the skill. */
        this.id = skillConfig.id;

        /** @type {string} The display name of the skill. */
        this.name = skillConfig.name;

        /** @type {string} A detailed description of what the skill does. */
        this.description = skillConfig.description || "";

        /** @type {object} The resource cost to use the skill (e.g., { ap: 2, mp: 10 }). */
        this.cost = skillConfig.cost || { ap: 1 };

        /** @type {number} The Action Point cost of the skill. */
        this.apCost = this.cost.ap || 0;
        this.mpCost = this.cost.mp || 0;
        
        /** @type {string} The category of targeting for the skill. */
        this.targetType = skillConfig.targetType || "self";

        /** @type {number} The range of the skill in hexes. */
        this.range = skillConfig.range || 0;

        /** @type {object[]} An array of effect objects that define the skill's logic. */
        this.effects = skillConfig.effects || [];

        /** @type {number} The base cooldown in turns after the skill is used. */
        this.cooldown = skillConfig.cooldown || 0;

        /** @type {boolean} Indicates if the skill is a toggleable stance. */
        this.toggleable = skillConfig.toggleable || false;
        
        /** @type {string|null} The name of the status effect this skill applies. */
        this.statusToApply = skillConfig.statusToApply || null;
        
        /** @type {boolean} Determines if a movement path is shown in the preview. Defaults to false. */
        this.allowsMovement = skillConfig.allowsMovement === true; // Only true if explicitly set to true

        // --- Runtime State ---

        /** * The number of turns remaining before the skill can be used again.
         * @type {number} 
         */
        this.cooldownTurnsRemaining = 0;

        /** * The current active state for toggleable skills.
         * @type {boolean} 
         */
        this.isActive = false;
    }

    /**
     * Checks if the skill is currently on cooldown.
     * @returns {boolean} True if on cooldown, false otherwise.
     */
    isOnCooldown() {
        return this.cooldownTurnsRemaining > 0;
    }

    /**
     * Puts the skill on its full cooldown.
     */
    startCooldown() {
        this.cooldownTurnsRemaining = this.cooldown;
    }

    /**
     * Decrements the cooldown timer by one turn.
     * @returns {boolean} True if the cooldown was decremented, false otherwise.
     */
    decrementCooldown() {
        if (this.cooldownTurnsRemaining > 0) {
            this.cooldownTurnsRemaining--;
            return true;
        }
        return false;
    }
}

export default Skill;
