import Skill from '../skill.js'; // Assuming skill.js exists and is correctly structured
import CONFIG from '../config.js';

/**
 * Manages an entity's known skills, their cooldowns, and their readiness.
 * @class SkillsComponent
 */
class SkillsComponent {
    /**
     * @param {object} config - Configuration object.
     * @param {Array<object>} config.skillsData - Array of skill config objects from CONFIG.skills.
     */
    constructor(config = {}) {
        this.name = 'skills';
        /** @type {Entity|null} */
        this.entity = null;
        /** @type {Skill[]} */
        this.skills = [];
        /** @private */
        // skillsData should be an array of skill *configurations* (objects from CONFIG.skills)
        this.initialSkillConfigs = config.skillsData || [];
    }

    init() {
        this.skills = this.initialSkillConfigs.map(skillConfig => {
            if (skillConfig && skillConfig.id) {
                // Pass the full skillConfig object to the Skill constructor
                return new Skill(skillConfig);
            }
            console.warn(`[SkillsComponent] Invalid skillConfig provided:`, skillConfig);
            return null;
        }).filter(skill => skill !== null);

        this._setupEventListeners();
        this.publishSkillsChanged(); // Initial state
    }

    _setupEventListeners() {
        if (this.entity && this.entity.game && this.entity.game.eventBus) {
            this.entity.game.eventBus.subscribe('turnStarted', (payload) => {
                // Decrement cooldowns at the start of the entity's turn
                if (this.entity.type === 'player' && payload.currentTurn === 'player') {
                    this.decrementAllCooldowns();
                } else if (this.entity.type !== 'player' && payload.currentTurn === 'enemies') {
                    // This part might need refinement if enemies have individual turns within "enemies" phase
                    this.decrementAllCooldowns();
                }
            });
        }
    }

    getSkill(skillId) {
        return this.skills.find(s => s.id === skillId);
    }

    getAllSkills() {
        return this.skills;
    }
    
    learnSkillById(skillId) {
        if (this.skills.some(s => s.id === skillId)) {
            console.warn(`[SkillsComponent] Entity ${this.entity?.name} already knows skill ${skillId}.`);
            return false; 
        }

        const skillConfig = CONFIG.skills[skillId];
        if (skillConfig) {
            this.skills.push(new Skill(skillConfig));
            this.publishSkillsChanged();
            return true;
        }
        console.warn(`[SkillsComponent] Skill config for ID "${skillId}" not found in CONFIG.skills.`);
        return false;
    }

    canUseSkill(skillId) {
        const skill = this.getSkill(skillId);
        if (!skill) {
            console.warn(`[SkillsComponent] Attempted to check usability for unknown skill: ${skillId}`);
            return false;
        }
        if (skill.isOnCooldown()) return false;
        
        const stats = this.entity.getComponent('stats');
        if (!stats) return false;

        const canAffordAP = stats.canAfford(skill.apCost || 0);
        const canAffordMP = stats.canAffordMP(skill.mpCost || 0);
        
        return canAffordAP && canAffordMP;
    }

    startCooldown(skillId) {
        const skill = this.getSkill(skillId);
        if (skill) {
            skill.startCooldown();
            this.publishSkillsChanged();
        }
    }

    cancelCooldown(skillId) {
        const skill = this.getSkill(skillId);
        if (skill) {
            skill.cooldownTurnsRemaining = 0; // Reset cooldown
            this.publishSkillsChanged();
        }
    }

    decrementAllCooldowns() {
        let changed = false;
        this.skills.forEach(skill => {
            if (skill.decrementCooldown()) {
                changed = true;
            }
        });
        if (changed) {
            this.publishSkillsChanged();
        }
    }
    
    publishSkillsChanged() {
        if (this.entity && this.entity.game && this.entity.game.eventBus) {
            this.entity.game.eventBus.publish('skillsChanged', { entityId: this.entity.id, skills: this.skills });
        }
    }

    getSavableSkillsData() {
        return this.skills.map(skill => ({
            id: skill.id,
            cooldownTurnsRemaining: skill.currentCooldown, // Assuming Skill class has currentCooldown
            // isActive: skill.isActive // For toggleable skills, if Skill class supports it
        }));
    }
}

export default SkillsComponent;
