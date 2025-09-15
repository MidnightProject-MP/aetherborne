import CONFIG from '../config.js';

/**
 * Manages the core attributes and dynamic resources (HP, AP, MP) for an entity.
 * This component acts as a data container and provides methods to modify stats,
 * emitting events when changes occur.
 * @class StatsComponent
 */
class StatsComponent {
    /**
     * @param {object} [config={}] - Configuration data, typically from archetype's baseStats or enemy definition.
     */
    constructor(config = {}) {
        this.name = 'stats';
        /** @type {Entity|null} */
        this.entity = null;
        
        // Base attributes from config (e.g., archetype's baseStats)
        this.attributes = {
            body: config.body || 0,
            mind: config.mind || 0,
            instinct: config.instinct || 0,
        };
        
        // Direct stats from config (can be pre-calculated or base values)
        this.maxLife = config.hp || CONFIG.player.baseLife;
        this.life = this.maxLife; // Start with full life
        
        this.maxManaPoints = config.mp || CONFIG.player.baseManaPoints;
        this.manaPoints = this.maxManaPoints; // Start with full MP

        this.maxActionPoints = config.ap || CONFIG.player.baseActionPoints;
        this.actionPoints = this.maxActionPoints; // Start with full AP

        this.attackPower = config.attackPower || CONFIG.player.baseAttackPower;
        this.defense = config.defense || 0;
        this.magicAttack = config.magicAttack || 0;
        this.magicDefense = config.magicDefense || 0;
        this.accuracy = config.accuracy || 75;
        this.evasion = config.evasion || 5;
        this.critChance = config.critChance || 5;
        this.critMultiplier = config.critMultiplier || 1.5;
        this.movementRange = config.movementRange || 3; // Used by MovementComponent, but good to have here

        // Traits can be passed in config too, e.g. from character creation or archetype
        this.traits = [...(config.traits || [])];

        // --- NEW: Progression Stats ---
        this.xp = config.xp || 0;
        this.level = config.level || 1;
    }

    /**
     * Initializes the component after it's attached to an entity.
     * For now, most initialization happens in constructor based on config.
     * This can be expanded if needed for post-attachment setup.
     */
    init() {
        // If recalculation based on traits or other factors is needed post-attachment:
        // this.recalculateDerivedStats(); 
        // this.life = this.maxLife;
        // this.manaPoints = this.maxManaPoints;
        // this.actionPoints = this.maxActionPoints;

        console.log(`[StatsComponent] Initialized for ${this.entity?.name}: HP ${this.life}/${this.maxLife}, MP ${this.manaPoints}/${this.maxManaPoints}, AP ${this.actionPoints}/${this.maxActionPoints}`);
        this.publishStatsChanged(); // Ensure UI is updated on init
    }

    /**
     * Recalculates derived stats if attributes or traits change.
     * Currently, base stats are set directly in constructor from archetype.
     * This method can be used if attributes (body, mind, instinct) are meant to be dynamic
     * and influence maxHP, maxMP, maxAP during gameplay.
     */
    recalculateDerivedStats() {
        // Example: If attributes can change and then max values need update
        // const body = Number(this.attributes.body) || 0;
        // this.maxLife = CONFIG.player.baseLife + (body * CONFIG.player.lifePerBodyPoint);
        // Similar for MP with mind, AP with instinct
        // ...
        // this.publishStatsChanged();
        console.log('[StatsComponent] recalculateDerivedStats called (currently, primary stats set in constructor).');
    }

    isAlive() { return this.life > 0; }

    takeDamage(amount) {
        if (!this.isAlive()) return;
        // Future: Apply defense, resistances, damage reduction from status effects
        const actualDamage = Math.max(0, amount); // Placeholder
        this.life = Math.max(0, this.life - actualDamage);
        this.publishStatsChanged();

        if (this.life <= 0) {
            console.log(`[StatsComponent] ${this.entity.name} has been defeated.`);
            if (this.entity.type === 'player') {
                this.entity.game.handleGameOver("Player has been defeated!");
            } else {
                this.entity.game.eventBus.publish('enemyDefeated', { entityId: this.entity.id, entity: this.entity });
            }
        }
    }

    heal(amount) {
        if (!this.isAlive() || amount <= 0) return;
        this.life = Math.min(this.maxLife, this.life + amount);
        this.publishStatsChanged();
    }
    
    canAfford(cost) { // For AP
        return this.actionPoints >= cost;
    }

    spendActionPoints(amount) {
        if (this.canAfford(amount)) {
            this.actionPoints -= amount;
            this.publishStatsChanged();
            return true;
        }
        return false;
    }
    
    canAffordMP(cost) {
        return this.manaPoints >= cost;
    }

    spendManaPoints(amount) {
        if (this.canAffordMP(amount)) {
            this.manaPoints -= amount;
            this.publishStatsChanged();
            return true;
        }
        return false;
    }
    
    gainActionPoints(amount) {
        if (amount <= 0) return;
        this.actionPoints = Math.min(this.maxActionPoints, this.actionPoints + amount);
        this.publishStatsChanged();
    }

    gainManaPoints(amount) {
        if (amount <= 0) return;
        this.manaPoints = Math.min(this.maxManaPoints, this.manaPoints + amount);
        this.publishStatsChanged();
    }

    resetAP() {
        this.actionPoints = this.maxActionPoints;
        this.publishStatsChanged();
    }

    publishStatsChanged() {
        if (this.entity && this.entity.game && this.entity.game.eventBus) {
            this.entity.game.eventBus.publish('statsChanged', { entityId: this.entity.id, stats: this });
        }
    }
    
    getSavableStats() {
        return {
            attributes: { ...this.attributes },
            traits: [...this.traits],
            maxLife: this.maxLife,
            maxActionPoints: this.maxActionPoints,
            maxManaPoints: this.maxManaPoints,
            life: this.life,
            actionPoints: this.actionPoints,
            manaPoints: this.manaPoints,
            // include other stats like attackPower, defense etc. if they can change
            attackPower: this.attackPower,
            defense: this.defense,
            xp: this.xp,
            level: this.level
        };
    }

    getCurrentAP() { return this.actionPoints; }
    getCurrentMP() { return this.manaPoints; }
    getCurrentHP() { return this.life; }
}

export default StatsComponent;
