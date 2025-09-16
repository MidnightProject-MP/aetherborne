/**
 * Manages all updates to the player's Heads-Up Display (HUD), including
 * resource bars (HP, MP, AP), the skill bar, and the tension meter.
 * It listens for game events and updates the DOM accordingly.
 * @class PlayerHUD
 */
class PlayerHUD {
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error("PlayerHUD requires an EventBus instance.");
        }
        this.eventBus = eventBus;
        this.player = null; // Will be set by Orchestrator
        this.gameMap = null; // Will be set by Orchestrator
        this.disabled = true; // Disabled until player and map are set
        
        this.uiElements = {
            hpFill: document.getElementById('hp-bar-fill'),
            hpText: document.getElementById('hp-bar-text'),
            mpFill: document.getElementById('mp-bar-fill'), // Added
            mpText: document.getElementById('mp-bar-text'),   // Added
            apText: document.getElementById('ap-bar-text'),
            skillBar: document.getElementById('skill-bar'),
            tensionLevel: document.getElementById('tension-level'),
            turnIndicator: document.getElementById('turn-indicator'),
            endTurnButton: document.getElementById('end-turn-button'),
            mapNameDisplay: document.getElementById('map-name-display') // New
        };

        this.handleEndTurnClick = () => {
            if (this.disabled || !this.player || this.uiElements.endTurnButton.disabled) return;
            console.log('[PlayerHUD] End Turn button clicked.');
            this.eventBus.publish('playerEndTurn'); // Game listens to this
        };

        this._setupEventListeners();
        console.log('[PlayerHUD] Constructor called.');
    }

    _setupEventListeners() {
        this.eventBus.subscribe('statsChanged', (payload) => {
            // Only update if it's for the current player entity
            if (this.player && payload.entityId === this.player.id) {
                console.log('[PlayerHUD] statsChanged event received for player:', payload);
                this.updateResourceBars(payload.stats);
            }
        });
        this.eventBus.subscribe('skillsChanged', (payload) => {
            if (this.player && payload.entityId === this.player.id) {
                console.log('[PlayerHUD] skillsChanged event received for player:', payload);
                this.updateSkillBar(payload.skills); // Pass the array of skill objects
            }
        });
        this.eventBus.subscribe('tensionChanged', (payload) => {
            console.log('[PlayerHUD] tensionChanged event received:', payload);
            this.updateTensionMeter(payload.level);
        });
        this.eventBus.subscribe('turnStarted', (payload) => {
            console.log('[PlayerHUD] turnStarted event received:', payload);
            if (payload && payload.currentTurn) {
                this.updateTurnIndicator(payload.currentTurn);
            }
        });
        // New: Listen for map info to update the display
        this.eventBus.subscribe('mapInfoLoaded', (payload) => {
            this.updateMapName(payload.name);
        });
        this.eventBus.subscribe('gameMapReady', () => {
            console.log("[PlayerHUD] gameMapReady event received. HUD should be fully functional.");
            // Player and gameMap are assumed to be set by Orchestrator before this.
            // Initial update based on game state.
            if (this.player && this.player.getComponent('stats')) {
                this.updateResourceBars(this.player.getComponent('stats'));
            }
            if (this.player && this.player.getComponent('skills')) {
                this.updateSkillBar(this.player.getComponent('skills').getAllSkills());
            }
            // Turn indicator is usually set by Orchestrator initially or by first 'turnStarted'
        });
    }

    updateResourceBars(stats) {
        if (!stats || this.disabled) return;

        if (this.uiElements.hpFill && this.uiElements.hpText) {
            const hpPercent = stats.maxLife > 0 ? (stats.life / stats.maxLife) * 100 : 0;
            this.uiElements.hpFill.style.width = `${Math.max(0, Math.min(100, hpPercent))}%`;
            this.uiElements.hpText.textContent = `${stats.life} / ${stats.maxLife}`;
        }
        
        if (this.uiElements.mpFill && this.uiElements.mpText) {
            const mpPercent = stats.maxManaPoints > 0 ? (stats.manaPoints / stats.maxManaPoints) * 100 : 0;
            this.uiElements.mpFill.style.width = `${Math.max(0, Math.min(100, mpPercent))}%`;
            this.uiElements.mpText.textContent = `${stats.manaPoints} / ${stats.maxManaPoints}`;
        }

        if (this.uiElements.apText) {
            this.uiElements.apText.textContent = `${stats.actionPoints} / ${stats.maxActionPoints}`;
        }
    }

    updateSkillBar(skills) { // skills is an array of Skill instances
        if (!this.uiElements.skillBar || this.disabled || !this.player) return;
        this.uiElements.skillBar.innerHTML = ''; 
        
        const skillsComponent = this.player.getComponent('skills'); // For canUseSkill check

        skills.forEach(skill => { // skill is a Skill instance
            const button = document.createElement('button');
            button.className = 'skill-button';
            button.title = `${skill.description}\nAP: ${skill.apCost || 0}, MP: ${skill.mpCost || 0}\nCD: ${skill.cooldown}`;
            
            let buttonText = skill.name;
            if (skill.isOnCooldown()) {
                buttonText += ` (${skill.currentCooldown})`; // Assuming Skill class has currentCooldown
            }
            button.textContent = buttonText;
            
            // Disable button if cannot use skill (cooldown, AP, MP)
            button.disabled = !skillsComponent.canUseSkill(skill.id);

            button.addEventListener('click', () => {
                if (this.player && !button.disabled) {
                    console.log(`[PlayerHUD] Skill button clicked: ${skill.id}`);
                    // Let PlayerInputComponent handle targeting if needed, or Game handle activation
                    this.eventBus.publish('playerAttemptSkill', { 
                        entityId: this.player.id, 
                        skillId: skill.id,
                        // skillInstance: skill // Optionally pass the skill instance
                    });
                }
            });
            this.uiElements.skillBar.appendChild(button);
        });
    }

    updateTensionMeter(level) {
        if (this.uiElements.tensionLevel && !this.disabled) {
            this.uiElements.tensionLevel.textContent = `Tension: ${level.name}`;
            this.uiElements.tensionLevel.style.color = level.color || 'white';
        }
    }

    updateTurnIndicator(turn) {
        if (this.disabled) return;
        if (!this.uiElements.turnIndicator || typeof turn !== 'string') return;

        this.uiElements.turnIndicator.textContent = (turn === 'player') ? "Your Turn" : "Enemy Turn";

        if (this.uiElements.endTurnButton) {
            const isPlayerTurn = (turn === 'player');
            this.uiElements.endTurnButton.disabled = !isPlayerTurn;
            
            this.uiElements.endTurnButton.removeEventListener('click', this.handleEndTurnClick);
            if (isPlayerTurn) {
                this.uiElements.endTurnButton.addEventListener('click', this.handleEndTurnClick);
            }
        }
    }

    /**
     * Updates the map name display on the HUD.
     * @param {string} name - The name of the current map.
     */
    updateMapName(name) {
        if (this.uiElements.mapNameDisplay && !this.disabled) {
            this.uiElements.mapNameDisplay.textContent = name || 'An Unknown Realm';
        }
    }

    setGameMap(gameMap) {
        this.gameMap = gameMap;
        this.checkAndEnable();
    }

    setPlayer(player) {
        this.player = player;
        this.checkAndEnable();
        // Initial UI update for the new player
        if (player && player.getComponent('stats')) {
            this.updateResourceBars(player.getComponent('stats'));
        }
        if (player && player.getComponent('skills')) {
            this.updateSkillBar(player.getComponent('skills').getAllSkills());
        }
    }

    checkAndEnable() {
        if (this.player && this.gameMap) {
            this.disabled = false;
            console.log("[PlayerHUD] Enabled.");
        } else {
            this.disabled = true;
            console.log("[PlayerHUD] Disabled (missing player or gameMap).");
        }
    }
}

export default PlayerHUD;
