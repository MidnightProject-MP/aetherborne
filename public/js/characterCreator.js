/**
 * @file characterCreator.js
 * @description Manages the character creation UI and logic.
 */

// No longer importing a static CONFIG file.

export class CharacterCreator {
    /**
     * @param {HTMLElement} container The DOM element to render the UI into.
     * @param {EventBus} eventBus The central event bus.
     * @param {Object} config The game's configuration object, fetched from the server.
     */
    constructor(container, eventBus, config) {
        this.container = container;
        this.eventBus = eventBus;
        this.config = config; // Use the server-provided config
        this.selectedArchetypeId = null;
        this.selectedTraits = new Set();
        this.characterName = "Aetherius"; // Default name

        this.render();
        this.bindEvents();
    }

    render() {
        let archetypesHtml = '<h3>Choose an Archetype</h3>';
        for (const id in this.config.archetypes) {
            const archetype = this.config.archetypes[id];
            archetypesHtml += `
                <div class="archetype-card" data-id="${id}">
                    <h4>${archetype.name}</h4>
                    <p>${archetype.description}</p>
                </div>
            `;
        }

        let traitsHtml = '<h3>Choose Traits (Optional)</h3>';
        for (const id in this.config.traits) {
            const trait = this.config.traits[id];
            traitsHtml += `
                <div class="trait-card" data-id="${id}">
                    <h4>${id}</h4>
                    <p>${trait.description}</p>
                </div>
            `;
        }

        this.container.innerHTML = `
            <h2>Create Your Character</h2>
            <div>
                <label for="char-name">Name:</label>
                <input type="text" id="char-name" value="${this.characterName}">
            </div>
            <div id="archetypes-container">${archetypesHtml}</div>
            <div id="traits-container">${traitsHtml}</div>
            <button id="finalize-char-btn" disabled>Create</button>
        `;
    }

    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const archetypeCard = e.target.closest('.archetype-card');
            if (archetypeCard) {
                this.handleArchetypeSelection(archetypeCard.dataset.id);
            }

            const traitCard = e.target.closest('.trait-card');
            if (traitCard) {
                this.handleTraitSelection(traitCard.dataset.id);
            }
        });

        const finalizeBtn = this.container.querySelector('#finalize-char-btn');
        finalizeBtn.addEventListener('click', () => this.finalizeCharacter());

        const nameInput = this.container.querySelector('#char-name');
        nameInput.addEventListener('input', (e) => {
            this.characterName = e.target.value;
        });
    }

    handleArchetypeSelection(archetypeId) {
        this.selectedArchetypeId = archetypeId;
        
        this.container.querySelectorAll('.archetype-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.id === archetypeId);
        });

        this.container.querySelector('#finalize-char-btn').disabled = false;
    }

    handleTraitSelection(traitId) {
        const card = this.container.querySelector(`.trait-card[data-id="${traitId}"]`);
        if (this.selectedTraits.has(traitId)) {
            this.selectedTraits.delete(traitId);
            card.classList.remove('selected');
        } else {
            this.selectedTraits.add(traitId);
            card.classList.add('selected');
        }
    }

    finalizeCharacter() {
        if (!this.selectedArchetypeId) return;

        const archetype = this.config.archetypes[this.selectedArchetypeId];
        const traits = Array.from(this.selectedTraits).map(id => ({ id, ...this.config.traits[id] }));

        const characterData = {
            name: this.characterName,
            archetypeId: this.selectedArchetypeId,
            baseStats: { ...archetype.baseStats },
            skills: [...archetype.skills],
            traits: traits,
            currentMapId: this.config.prologueStartMapId
        };
        
        console.log("[CharacterCreator] Finalizing character:", characterData);
        this.eventBus.publish('characterCreated', characterData);
    }
}