/**
 * Handles player input, translating clicks on UI elements into game state changes.
 * This component no longer directly handles map clicks.
 * @class PlayerInputComponent
 */
class PlayerInputComponent {
    constructor() {
        this.name = 'playerInput';
        this.entity = null;
        this.inputMode = 'default'; // 'default', 'skill_targeting'
        this.activeSkillForTargeting = null;
    }

    init() {
        // PlayerInputComponent now only listens for mapRightClicked to cancel modes.
        // All left-click map interactions are handled by TargetPreviewSystem.
        // This ensures a clean separation of concerns.
        if (this.entity && this.entity.game && this.entity.game.eventBus) {
            this.entity.game.eventBus.subscribe('mapRightClicked', () => this._cancelAllModes());
        }
    }

    handleSkillActivationAttempt(skillInstance) {
        if (!this._canPlayerAct() || !skillInstance) return;

        if (this.inputMode === 'skill_targeting' && this.activeSkillForTargeting?.id === skillInstance.id) {
            this._cancelAllModes();
            return;
        }

        const skillsComponent = this.entity.getComponent('skills');
        if (!skillsComponent.canUseSkill(skillInstance.id)) {
            this.entity.game.eventBus.publish('combatLog', { message: `Cannot use ${skillInstance.name}.`, type: 'error' });
            return;
        }

        if (skillInstance.targetType === 'self') {
            this.entity.game.resolveentityAction({
                type: 'skill',
                sourceId: this.entity.id,
                details: { skillId: skillInstance.id }
            });
        } else {
            this.enterSkillTargetingMode(skillInstance);
        }
    }

    enterSkillTargetingMode(skill) {
        this.inputMode = 'skill_targeting';
        this.activeSkillForTargeting = skill;
        this.entity.game.eventBus.publish('combatLog', { message: `Targeting for ${skill.name}...`, type: 'info' });
        this.entity.game.eventBus.publish('previewAction', {
            type: 'skill_target',
            details: {
                skillId: skill.id,
                sourceHex: this.entity.hex,
                targetType: skill.targetType,
                range: skill.range,
                splashRadius: skill.splashRadius
            }
        });
    }

    _cancelAllModes() {
        if (this.inputMode !== 'default') {
            this.inputMode = 'default';
            this.activeSkillForTargeting = null;
            this.entity.game.eventBus.publish('clearPreview');
            this.entity.game.eventBus.publish('combatLog', { message: 'Targeting cancelled.', type: 'info' });
        }
    }

    _canPlayerAct() {
        return this.entity?.game?.gameState.currentTurn === 'player' &&
               !this.entity.game.gameState.isGameOver;
    }
}

export default PlayerInputComponent;