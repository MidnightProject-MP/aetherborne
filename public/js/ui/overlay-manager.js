/**
 * Manages all UI overlays, such as modals, tooltips, and choice prompts.
 * This class listens to events on the global event bus and displays the
 * appropriate UI, decoupling the overlay logic from game systems.
 * @class OverlayManager
 */
class OverlayManager {
    /**
     * @param {object} eventBus - The global event bus instance.
     * @param {string} [parentElementSelector=null] - Optional selector for the parent element. Defaults to document.body.
     */
    constructor(eventBus, parentElementSelector = null) {
        if (!eventBus) {
            throw new Error("OverlayManager requires an EventBus instance.");
        }

        /** @private */
        this.eventBus = eventBus;
        /** @private */
        this.overlayContainer = null;
        /** @private */
        this.activeOverlays = [];

        this._createContainer(parentElementSelector);
        this._injectStyles();
        this._setupEventListeners();
    }

    /**
     * Creates the main container for all overlays and appends it to the DOM.
     * @param {string|null} parentElementSelector
     * @private
     */
    _createContainer(parentElementSelector) {
        this.overlayContainer = document.createElement('div');
        this.overlayContainer.id = 'overlay-container';

        let parent = document.querySelector(parentElementSelector) || document.body;
        parent.appendChild(this.overlayContainer);
    }

    /**
     * Subscribes the manager to all relevant global events.
     * @private
     */
    _setupEventListeners() {
        this.eventBus.subscribe('gameOver', (payload) => this._showGameOverModal(payload));
        this.eventBus.subscribe('portalChoicesRequested', (payload) => this._showChoicesModal(payload));
        this.eventBus.subscribe('showHighScores', (payload) => this._showHighScoresModal(payload));
        // Add more listeners here as needed, e.g., for lore popups, settings menus, etc.
    }

    /**
     * Shows a modal with choices for the player.
     * @param {object} payload - The event payload.
     * @param {string} payload.title - The title of the choice prompt.
     * @param {Array<object>} payload.choices - The choices to present.
     * @private
     */
    _showChoicesModal({ title, choices }) {
        this.hideAll();

        const backdrop = this._createBaseOverlay('modal');
        const content = backdrop.querySelector('.overlay-content');
        
        const titleElem = document.createElement('h2');
        titleElem.textContent = title;
        content.appendChild(titleElem);

        const choiceContainer = document.createElement('div');
        choiceContainer.className = 'choice-container';

        choices.forEach(choice => {
            const button = document.createElement('button');
            button.className = 'choice-button';
            button.textContent = choice.name;
            button.title = choice.description;
            button.addEventListener('click', () => {
                choice.effect();
                this.hide(backdrop);
            });
            choiceContainer.appendChild(button);
        });
        
        content.appendChild(choiceContainer);
        this._show(backdrop);
    }

    /**
     * Shows the game over modal with a high score input.
     * @param {object} payload - The event payload.
     * @param {string} payload.message - The game over message.
     * @private
     */
    _showGameOverModal({ message, score }) {
        this.hideAll();
        
        const backdrop = this._createBaseOverlay('modal');
        const content = backdrop.querySelector('.overlay-content');
        
        const titleElem = document.createElement('h2');
        titleElem.textContent = message;
        content.appendChild(titleElem);

        const scoreElem = document.createElement('p');
        scoreElem.textContent = `Final Score: ${score}`;
        content.appendChild(scoreElem);

        // Add a message about score submission
        const infoElem = document.createElement('p');
        infoElem.style.fontSize = '0.9rem';
        infoElem.style.color = '#666';
        infoElem.textContent = 'Your score and replay are being submitted automatically.';
        content.appendChild(infoElem);
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'overlay-buttons';
        
        const returnButton = document.createElement('button');
        returnButton.textContent = 'Return to Main Menu';
        returnButton.addEventListener('click', () => {
            // Publish an event for the orchestrator to handle the page reload.
            this.eventBus.publish('returnToMainMenu');
        });
        
        buttonContainer.appendChild(returnButton);
        content.appendChild(buttonContainer);
        
        this._show(backdrop);
    }

    /**
     * Shows the high scores modal, created dynamically.
     * @param {object} payload - The event payload.
     * @param {Array} [payload.scores] - The list of high scores.
     * @param {string} [payload.error] - An error message, if any.
     * @private
     */
    _showHighScoresModal({ scores, error }) {
        this.hideAll();

        const backdrop = this._createBaseOverlay('modal');
        const content = backdrop.querySelector('.overlay-content');

        const titleElem = document.createElement('h2');
        titleElem.textContent = 'High Scores';
        content.appendChild(titleElem);

        const listContainer = document.createElement('ul');
        listContainer.className = 'high-score-list';

        if (error) {
            const errorItem = document.createElement('li');
            errorItem.textContent = error;
            listContainer.appendChild(errorItem);
        } else if (scores && scores.length > 0) {
            scores.forEach((score, index) => {
                const listItem = document.createElement('li');
                const rank = index + 1;
                const scoreText = `${score.name} - ${score.score}`;
                if (score.sessionId) {
                    listItem.innerHTML = `<span class="rank">${rank}.</span> <a href="replay.html?sessionId=${score.sessionId}" target="_blank">${scoreText}</a>`;
                } else {
                    listItem.innerHTML = `<span class="rank">${rank}.</span> ${scoreText}`;
                }
                listContainer.appendChild(listItem);
            });
        } else {
            const noScoresItem = document.createElement('li');
            noScoresItem.textContent = 'No high scores yet. Be the first!';
            listContainer.appendChild(noScoresItem);
        }

        content.appendChild(listContainer);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'overlay-buttons';

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            this.hide(backdrop);
        });

        buttonContainer.appendChild(closeButton);
        content.appendChild(buttonContainer);

        this._show(backdrop);
    }

    /**
     * Creates a base overlay element with a backdrop.
     * @param {'modal'|'tooltip'} type - The type of overlay.
     * @returns {HTMLElement} The created overlay element.
     * @private
     */
    _createBaseOverlay(type) {
        const backdrop = document.createElement('div');
        backdrop.className = 'overlay-backdrop';

        const overlay = document.createElement('div');
        overlay.className = `overlay-content ${type}`;
        
        backdrop.appendChild(overlay);
        return backdrop;
    }

    /**
     * Appends a prepared overlay to the container, making it visible.
     * @param {HTMLElement} overlayElement - The overlay element with its backdrop.
     * @private
     */
    _show(overlayElement) {
        this.overlayContainer.appendChild(overlayElement);
        this.activeOverlays.push(overlayElement);
    }

    /**
     * Hides and removes a specific overlay from the DOM.
     * @param {HTMLElement} overlay - The overlay element to hide.
     */
    hide(overlay) {
        if (!overlay || !this.overlayContainer.contains(overlay)) return;
        this.overlayContainer.removeChild(overlay);
        this.activeOverlays = this.activeOverlays.filter(o => o !== overlay);
    }

    /**
     * Hides and removes all currently active overlays.
     */
    hideAll() {
        this.activeOverlays.forEach(overlay => this.overlayContainer.removeChild(overlay));
        this.activeOverlays = [];
    }

    /**
     * Injects the necessary CSS for the overlays into the document's head.
     * @private
     */
    _injectStyles() {
        const styleId = 'overlay-manager-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            #overlay-container {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; /* Allow clicks to pass through by default */
                z-index: 1000;
            }
            .overlay-backdrop {
                position: fixed; /* Use fixed to cover the whole viewport */
                top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: auto; /* Capture clicks */
            }
            .overlay-content {
                background-color: #fff;
                color: #333;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                max-width: 500px;
                width: 90%;
                text-align: center;
            }
            .overlay-content h2 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.5rem;
            }
            .overlay-content p {
                margin-bottom: 1.5rem;
            }
            .overlay-content input {
                width: 100%;
                padding: 0.5rem;
                margin-bottom: 1rem;
                border-radius: 4px;
                border: 1px solid #ccc;
            }
            .overlay-buttons, .choice-container {
                display: flex;
                justify-content: center;
                gap: 1rem;
                flex-wrap: wrap;
            }
            .overlay-buttons button, .choice-container button {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                background-color: #4a4a4a;
                color: white;
                font-weight: bold;
                transition: background-color 0.2s;
            }
            .overlay-buttons button:hover, .choice-container button:hover {
                background-color: #6a6a6a;
            }
            .overlay-content ul.high-score-list {
                list-style: none;
                padding: 0;
                margin-bottom: 1.5rem;
                text-align: left;
            }
            .overlay-content ul.high-score-list li {
                padding: 0.5rem 1rem;
                border-bottom: 1px solid #eee;
                display: flex; /* Use flexbox for alignment */
                align-items: center;
            }
            .overlay-content ul.high-score-list li .rank {
                font-weight: bold;
                color: #888;
                margin-right: 1rem;
                min-width: 2em; /* Ensure alignment */
                text-align: right;
            }
            .overlay-content ul.high-score-list li:last-child {
                border-bottom: none;
            }
            .overlay-content ul.high-score-list a {
                text-decoration: none;
                color: #007bff; /* A standard link blue */
            }
            .overlay-content ul.high-score-list a:hover {
                text-decoration: underline;
            }
        `;
        document.head.appendChild(style);
    }
}

export default OverlayManager;
