import CONFIG from './config.js';

/**
 * Manages the UI and logic for the character creation screen.
 * It is initialized with a container element and an event bus,
 * and communicates its completion via that bus.
 * @class CharacterCreator
 */
export class CharacterCreator {
    /**
     * @param {HTMLElement} containerElement - The main container element for the character creation UI.
     * @param {object} eventBus - The global event bus instance.
     */
    constructor(containerElement, eventBus) {
        if (!containerElement || !eventBus) {
            throw new Error("CharacterCreator requires a container element and an event bus.");
        }
        
        /** @private */
        this.container = containerElement;
        /** @private */
        this.eventBus = eventBus;
        
        /** @private */
        this.state = {};

        this.initialize();
    }

    /**
     * Sets up the initial state and attaches all necessary event listeners.
     * @private
     */
    initialize() {
        this.reset();
        this.setupEventListeners();
        this._selectArchetype('warrior'); // Select warrior by default on load
    }

    /**
     * Resets the UI and internal state to its default values.
     */
    reset() {
        this.state = {
            selectedArchetype: null,
        };

        // Reset UI elements safely
        this.container.querySelectorAll('.class-btn.active').forEach(btn => btn.classList.remove('active'));
        
        const confirmButton = this.container.querySelector('#confirmCharacterButton');
        if (confirmButton) confirmButton.disabled = true;
        
        this.container.querySelector('#character-image').src = ""; // Clear image
        this._updateDerivedStatsUI();

        const statsContainer = this.container.querySelector('#character-stats-container');
        if (statsContainer) statsContainer.style.visibility = 'hidden';
    }

    /**
     * Attaches event listeners to the interactive elements within the container.
     * @private
     */
    setupEventListeners() {
        this.container.querySelectorAll('.class-btn').forEach(button => {
            button.addEventListener('click', () => {
                const archetypeId = button.dataset.archetype;
                this._selectArchetype(archetypeId);
            });
        });

        this.container.querySelector('#confirmCharacterButton')?.addEventListener('click', () => {
            if (!this.eventBus) {
                console.error("EventBus not initialized for character creator.");
                return;
            }
            const characterData = this._getCharacterCreationData();
            
            console.log("Publishing 'characterCreated' event", characterData);
            this.eventBus.publish('characterCreated', characterData);
        });
    }

    /**
     * Handles the logic for selecting an archetype.
     * @param {string} archetypeId - The ID of the selected archetype.
     * @private
     */
    _selectArchetype(archetypeId) {
        this.state.selectedArchetype = archetypeId;
        const archetypeData = CONFIG.archetypes[archetypeId] || {};

        // Update UI
        this.container.querySelectorAll('.class-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.archetype === archetypeId);
        });
        
        // Update character image with transition
        const characterImage = this.container.querySelector('#character-image');
        if (characterImage) {
            characterImage.style.opacity = '0';
            characterImage.style.transform = 'scale(0.95)';
            setTimeout(() => {
                characterImage.src = `/assets/${archetypeId}-nobg.png`; // Assuming assets/warrior.png etc.
                characterImage.alt = archetypeData.name;
                characterImage.style.opacity = '1';
                characterImage.style.transform = 'scale(1)';
            }, 300); // Matches CSS transition duration
        }

        // Set stats and update displays
        this.state.stats = { ...(archetypeData.attributes || { body: 10, mind: 10, instinct: 10 }) };
        
        this._updateDerivedStatsUI();

        const statsContainer = this.container.querySelector('#character-stats-container');
        if (statsContainer) statsContainer.style.visibility = 'visible';

        const confirmButton = this.container.querySelector('#confirmCharacterButton');
        if (confirmButton) confirmButton.disabled = false;
    }

    /**
     * Calculates derived stats based on the current state.
     * @returns {{maxLife: number, maxActionPoints: number, maxManaPoints: number}}
     * @private
     */
    _calculateDerivedStats() {
        const archetypeData = CONFIG.archetypes[this.state.selectedArchetype];
        if (!archetypeData) return { maxLife: 0, maxActionPoints: 0, maxManaPoints: 0 };
        const traits = archetypeData.traits || [];
        
        let maxLife = CONFIG.player.baseLife;
        let maxActionPoints = CONFIG.player.baseActionPoints;
        let maxManaPoints = CONFIG.player.baseManaPoints;

        maxLife += (this.state.stats.body - 10) * CONFIG.player.lifePerBodyPoint;
        maxActionPoints += Math.floor((this.state.stats.instinct - 10) / CONFIG.player.instinctForAPBonus);
        maxManaPoints += (this.state.stats.mind - 10) * CONFIG.player.manaPerMindPoint;

        // traits.forEach(traitId => {
        //     const traitConfig = CONFIG.traits[traitId];
        //     if (traitConfig) {
        //         if (traitConfig.lifeBonus) maxLife += traitConfig.lifeBonus;
        //         if (traitConfig.apBonus) maxActionPoints += traitConfig.apBonus;
        //         if (traitConfig.mpBonus) maxManaPoints += traitConfig.mpBonus;
        //     }
        // });

        return { maxLife: Math.floor(maxLife), maxActionPoints: Math.floor(maxActionPoints), maxManaPoints: Math.floor(maxManaPoints) };
    }

    /**
     * Updates the derived stats UI (HP, MP, AP). This is now a "safe" function.
     * @private
     */
    _updateDerivedStatsUI() {
        const derivedStats = this._calculateDerivedStats();
        
        const hpValue = this.container.querySelector('#pocHpValue');
        if (hpValue) {
            hpValue.innerText = `${derivedStats.maxLife} / ${derivedStats.maxLife}`;
        }

        const mpValue = this.container.querySelector('#pocMpValue');
        if (mpValue) {
            mpValue.innerText = `${derivedStats.maxManaPoints} / ${derivedStats.maxManaPoints}`;
        }
        
        const apValue = this.container.querySelector('#pocApValue');
        if (apValue) {
            apValue.innerText = derivedStats.maxActionPoints;
        }
    }
    
    /**
     * Gathers all data from the current creation state.
     * @returns {object} The complete character data object.
     * @private
     */
    _getCharacterCreationData() {
        const archetypeData = CONFIG.archetypes[this.state.selectedArchetype] || {};

        return {
            name: archetypeData.name || "Hero", // Use archetype name as default
            archetype: this.state.selectedArchetype,
            attributes: { ...this.state.stats },
            traits: archetypeData.traits || [],
            derivedStats: this._calculateDerivedStats()
        };
    }
}
