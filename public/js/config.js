/**
 * config.js
 * A central configuration file for the game. This file contains all STATIC data
 * that is not expected to change frequently and is core to the client's operation.
 * Dynamic data like archetypes, skills, and traits are fetched from the server.
 */

const CONFIG = {
    grid: {
        size: { x: 11, y: 13 },
        hexSize: { x: 24, y: 24 },
    },
    player: { // General player defaults, archetype stats will override/add to these
        baseLife: 50, // Fallback if archetype doesn't specify
        lifePerBodyPoint: 5,
        baseActionPoints: 3,
        instinctForAPBonus: 5, // How many instinct points grant +1 AP
        baseManaPoints: 20, // Fallback
        manaPerMindPoint: 2,
        baseDetection: 5, // Base detection score for player
        baseTensionResistance: 0,
        focusGainBaseChance: 20,
        focusLossBaseChance: 20,
    },
    prologueStartMapId: "prologue_map_1",

//     archetypes: {
//         warrior: {
//             name: "Warrior",
//             description: "Embodies raw physical strength and resilience.",
//             baseStats: { // These will be passed to StatsComponent
//                 body: 20,
//                 instinct: 10,
//                 mind: 10,
//                 // Derived or direct stats:
//                 hp: 150, // (CONFIG.player.baseLife (e.g. 0) + 20 * CONFIG.player.lifePerBodyPoint)
//                 mp: 30,  // (CONFIG.player.baseManaPoints (e.g. 0) + 10 * CONFIG.player.manaPerMindPoint)
//                 ap: 3,   // (CONFIG.player.baseActionPoints + Math.floor(10 / CONFIG.player.instinctForAPBonus))
//                 attackPower: 15,
//                 defense: 10,
//                 magicAttack: 5,
//                 magicDefense: 5,
//                 accuracy: 80,
//                 evasion: 10,
//                 critChance: 5,
//                 critMultiplier: 1.5,
//                 movementRange: 3
//             },
//             skills: ["multiSlash", "defenseStance", "jump"] // IDs of skills from CONFIG.skills
//         },
//         rogue: {
//             name: "Rogue",
//             description: "Emphasizes agility, precision, and exploiting weaknesses.",
//             baseStats: {
//                 body: 10,
//                 instinct: 20,
//                 mind: 10,
//                 hp: 100,
//                 mp: 40,
//                 ap: 4,
//                 attackPower: 12,
//                 defense: 5,
//                 magicAttack: 5,
//                 magicDefense: 5,
//                 accuracy: 90,
//                 evasion: 25,
//                 critChance: 15,
//                 critMultiplier: 2.0,
//                 movementRange: 4
//             },
//             skills: ["sneakAttack", "stealthStance", "roll"]
//         },
//         magician: {
//             name: "Magician",
//             description: "Specializes in arcane powers, dealing magic damage.",
//             baseStats: {
//                 body: 10,
//                 instinct: 10,
//                 mind: 20,
//                 hp: 90,
//                 mp: 80,
//                 ap: 3,
//                 attackPower: 5,
//                 defense: 4,
//                 magicAttack: 18,
//                 magicDefense: 12,
//                 accuracy: 85,
//                 evasion: 15,
//                 critChance: 5,
//                 critMultiplier: 1.5,
//                 movementRange: 3
//             },
//             skills: ["fireball", "manaShield", "teleport"]
//         }
//     },

//     traits: { // Kept your existing trait structure for now
//         "Courageous": { description: "Grants +10% damage when at full HP.", tags: ["Combat", "Passive"] },
//         "Vigorous": { lifeBonus: 15, description: "Adds +15 Max Life.", tags: ["Survivability", "Passive"] },
//         "Wise": { mpRegenBonus: 1, description: "Increases MP regeneration by 1.", tags: ["Mental", "Regeneration"] },
//         "Sneaky": { description: "Reduces enemy detection radius.", tags: ["Stealth", "Exploration"] },
//         "Cunning": { critChanceBonus: 5, description: "Boosts critical hit chance by 5%.", tags: ["Combat", "Tactical"] },
//         "Agile": { apBonus: 1, description: "+1 Max AP.", tags: ["Utility", "Agility"] },
//         "Arcane Affinity": { mpBonus: 10, description: "+10 Max MP.", tags: ["Magic", "Utility"] },
//         "Tough": { lifeBonus: 5, description: "+5 Max Life.", tags: ["Defensive", "Physical"] },
//         "Power Strike": { attackBonus: 2, description: "Your basic attacks hit with +2 greater force.", tags: ["Offensive", "Physical"]},
//         "Quick Reflexes": { evasionBonus: 5, description: "Your agility allows you to evade attacks more easily (+5% Evasion).", tags: ["Defensive", "Agility"]},
//         "Precise Aim": { accuracyBonus: 5, description: "You have a knack for hitting vital spots (+5% Accuracy).", tags: ["Offensive", "Precision"]},
//         "Arcane Attunement": { magicDamageBonus: 0.1, description: "Enhances your spells (+10% Magic Damage).", tags: ["Offensive", "Magic"]},
//         "Mana Font": { mpBonus: 5, mpRegenBonus: 0.5, description: "Grants +5 Max MP and slightly better mana recovery.", tags: ["Utility", "Magic"]}
//     },

//     skills: {
//         // Warrior
//                 multiSlash: { id: "multiSlash", name: "Multi Slash", apCost: 3, mpCost: 0, cooldown: 2, type: "attack", description: "Strike up to 3 adjacent enemies. Bonus if Winded from Jump.", targetType: "multi-enemy-adjacent-cone", range: 1, effects: [{ type: "custom_script", scriptId: "multiSlash" }]}, // Example of an escape hatch for complex logic
//         defenseStance: { 
//             id: "defenseStance", name: "Defense Stance", apCost: 2, mpCost: 5, cooldown: 0, 
//             type: "buff", description: "Reduce incoming damage by 50%. Enter Fortified state.", 
//             targetType: "self",
//             effects: [
//                 { type: 'apply_status', statusId: 'fortified', target: 'self' }
//             ]
//         },
//         jump: { 
//             id: "jump", name: "Jump", apCost: 4, mpCost: 10, cooldown: 3, 
//             type: "movement_utility", range: 2, description: "Leap to a tile. Enter Winded state. Stun if Fortified.", 
//             targetType: "empty_hex_range",
//             allowsMovement: false, // Explicitly disallow movement preview for Jump
//             effects: [
//                 { type: 'movement', moveType: 'teleport', target: 'self_to_target_hex' },
//                 { type: 'apply_status', statusId: 'winded', target: 'self' }
//             ]
//         },

//         // Rogue
//         sneakAttack: { id: "sneakAttack", name: "Sneak Attack", apCost: 2, mpCost: 5, cooldown: 1, type: "attack", description: "Critical damage if target unaware/flanked or user Stealthed. Ends Stealth.", targetType: "single-enemy", range: 1, effects: [{ type: "damage", /* complex logic here */ }] },
//         stealthStance: { id: "stealthStance", name: "Stealth Stance", apCost: 1, mpCost: 8, cooldown: 2, type: "buff_state", duration: 1, description: "Enter Stealth. Silent movement/Roll. +1 AP next turn.", statusToApply: "stealth", targetType: "self" },
//         roll: { 
//             id: "roll", name: "Roll", apCost: 1, mpCost: 0, cooldown: 2, 
//             type: "movement_utility", range: 2, description: "Quickly roll 2 hexes. Briefly invulnerable. Can pass through enemies.", 
//             targetType: "directional_empty_hex",
//             allowsMovement: true, // Explicitly allow movement preview for Roll
//             effects: [
//                 { type: 'movement', moveType: 'teleport', target: 'self_to_target_hex' }
//             ]
//         },

//         // Magician
//         fireball: { 
//             id: "fireball", name: "Fireball", apCost: 3, mpCost: 12, cooldown: 0, 
//             type: "attack_area", range: 6, description: "Launch fiery projectile. Instant if cast after Teleport.", 
//             targetType: "hex_area",
//             effects: [
//                 { 
//                     type: 'damage', 
//                     target: 'aoe_at_target_hex', 
//                     splashRadius: 2, 
//                     baseAmount: 25, 
//                     damageType: 'fire' 
//                 }
//             ] 
//         },
//         manaShield: { id: "manaShield", name: "Mana Shield", apCost: 2, mpCost: 10, cooldown: 0, type: "buff", duration: 1, description: "Reduce incoming damage by 60%. Enter Shielded state. Fireball +1 range.", statusToApply: "shielded", targetType: "self" },
//         teleport: { 
//             id: "teleport", name: "Teleport", apCost: 2, mpCost: 15, cooldown: 0, 
//             type: "movement_utility", range: 3, description: "Instantly move to visible tile. Next skill cast is free.", 
//             targetType: "hex_visible",
//             allowsMovement: true, // Explicitly allow movement preview for Teleport
//             effects: [
//                 { type: 'movement', moveType: 'teleport', target: 'self_to_target_hex' }
//             ]
//         }
//     },

//     statusEffects: { // Definitions for status effects
//         fortified: { id: "fortified", name: "Fortified", duration: 1, effects: [{ type: "stat_modifier", stat: "damageReduction", value: 0.5, modifierType: "multiplier" }], description: "Damage taken reduced by 50%." },
//         winded: { id: "winded", name: "Winded", duration: 1, effects: [], description: "Recovering from an exertive leap." },
//         revealed: { id: "revealed", name: "Revealed", duration: 1, effects: [], description: "No longer hidden." },
//         stealth: { id: "stealth", name: "Stealth", duration: 1, // Duration can be special, e.g., until attack
//             effects: [
//                 { type: "stat_modifier", stat: "apRegenBonus", value: 1, onTurnEnd: true }, // Example: +1 AP at start of next turn
//                 { type: "visibility_modifier", level: "greatly_reduced" }
//             ],
//             description: "Concealed from enemies. Movement is silent. Broken by attacks."
//         },
//         shielded: { id: "shielded", name: "Shielded", duration: 1, effects: [{ type: "stat_modifier", stat: "damageReduction", value: 0.6, modifierType: "multiplier" }], description: "Magical shield reduces damage by 60%." },
//         overload: { id: "overload", name: "Overload", duration: 2, effects: [{ type: "stat_modifier", stat: "mpRegen", value: -5, modifierType: "flat" }], description: "Mana pathways are strained." }
//     },
    
    tension: {
        levels: [
            { name: "Low", xpMultiplier: 1.0, color: "green" },
            { name: "Medium", xpMultiplier: 1.2, color: "yellow" },
            { name: "High", xpMultiplier: 1.5, color: "red" }
        ],
        influence: {
            damageTaken: 0.1,
            accuracyReduction: 5,
            critChanceReduction: 3,
        },
    },

    combatFormulas: {
        base: { accuracyPhysical: 75, accuracyMagical: 70, evasion: 5, damagePhysical: 5, damageMagical: 8, defensePhysical: 2, defenseMagical: 2, critChancePhysical: 5, critChanceMagical: 5, resiliencePhysical: 5, resilienceMagical: 5, },
        factors: { accuracyInstinctFactor: 1.5, accuracyBodyFactor: 0.5, accuracyMindFactor: 1.5, accuracyInstinctMagicFactor: 0.75, distanceFactorPhysical: 2, distanceFactorMagical: 1, evasionInstinctFactor: 2, bodyPhysDamageFactor: 1, instinctPhysDamageFactor: 0.5, mindMagDamageFactor: 1.2, defenseBodyFactor: 1, defenseInstinctPhysFactor: 0.5, defenseMindFactor: 1, defenseInstinctMagFactor: 0.5, critInstinctFactor: 1, critMindFactor: 1, critDamageMultiplier: 1.5, resilienceBodyFactor: 1, resilienceInstinctFactor: 1, resilienceMindFactor: 1, resilienceInstinctMagFactor: 0.75, },
        settings: { minimumDamage: 1, maxAccuracy: 95, minAccuracy: 5, maxEvasion: 75, maxCritChance: 50, minCritChance: 0, maxResilience: 75, }
    },

    entityBlueprints: { // Blueprints for all entity types in the game.
        player: {
            components: [
                { name: 'stats', class: 'StatsComponent', argsSource: 'archetypeBaseStats' },
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: 'blue', radius: 15 } },
                { name: 'movement', class: 'MovementComponent', argsSource: 'archetypeBaseStats' },
                { name: 'skills', class: 'SkillsComponent', argsSource: 'archetypeSkills' },
                { name: 'playerInput', class: 'PlayerInputComponent' },
                { name: 'visibility', class: 'VisibilityComponent', args: { sightRangeFull: 4, sightRangePartial: 6 } },
                { name: 'statusEffects', class: 'StatusEffectComponent' }
            ],
            entityProperties: { blocksMovement: true, zIndex: 100 }
        },
        // Generic fallback blueprint
        enemy: {
            components: [
                { name: 'stats', class: 'StatsComponent', argsSource: 'entityProperties', dataSourceKey: 'stats' },
                { name: 'renderable', class: 'RenderableComponent', argsSource: 'entityProperties', dataSourceKey: 'renderable' },
                { name: 'movement', class: 'MovementComponent', argsSource: 'entityProperties', dataSourceKey: 'movement' },
                { name: 'behavior', class: 'BehaviorComponent', argsSource: 'entityProperties', dataSourceKey: 'behavior' },
                { name: 'intent', class: 'IntentComponent' },
                { name: 'visibility', class: 'VisibilityComponent', args: { sightRangeFull: 3, sightRangePartial: 5 } },
                { name: 'statusEffects', class: 'StatusEffectComponent' }
            ],
            entityProperties: { blocksMovement: true, zIndex: 90 }
        },
        // Specific enemy blueprints
        goblinScout: {
            components: [
                { name: 'stats', class: 'StatsComponent', args: { hp: 35, ap: 4, attackPower: 8, defense: 2, movementRange: 4, xp: 5 } },
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#90ee90', radius: 12 } },
                { name: 'movement', class: 'MovementComponent', args: { movementRange: 4 } },
                { name: 'behavior', class: 'BehaviorComponent', args: { type: 'basicMelee' } },
                { name: 'intent', class: 'IntentComponent' },
                { name: 'visibility', class: 'VisibilityComponent', args: { sightRangeFull: 4, sightRangePartial: 6 } },
                { name: 'statusEffects', class: 'StatusEffectComponent' }
            ],
            entityProperties: { blocksMovement: true, zIndex: 90 }
        },
        goblinBrute: {
            components: [
                { name: 'stats', class: 'StatsComponent', args: { hp: 80, ap: 3, attackPower: 15, defense: 5, movementRange: 2, xp: 20 } },
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#228b22', radius: 16 } },
                { name: 'movement', class: 'MovementComponent', args: { movementRange: 2 } },
                { name: 'behavior', class: 'BehaviorComponent', args: { type: 'basicMelee' } },
                { name: 'intent', class: 'IntentComponent' },
                { name: 'visibility', class: 'VisibilityComponent', args: { sightRangeFull: 3, sightRangePartial: 5 } },
                { name: 'statusEffects', class: 'StatusEffectComponent' }
            ],
            entityProperties: { blocksMovement: true, zIndex: 90 }
        },
        playerGhost: {
            components: [
                { name: 'stats', class: 'StatsComponent', args: { hp: 100, ap: 3, attackPower: 12, defense: 8, movementRange: 3, xp: 50 } },
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#add8e6', radius: 15, opacity: 0.7 } },
                { name: 'movement', class: 'MovementComponent', args: { movementRange: 3 } },
                { name: 'behavior', class: 'BehaviorComponent', args: { type: 'basicMelee' } },
                { name: 'intent', class: 'IntentComponent' },
                { name: 'visibility', class: 'VisibilityComponent', args: { sightRangeFull: 4, sightRangePartial: 6 } },
                { name: 'statusEffects', class: 'StatusEffectComponent' }
            ],
            entityProperties: { blocksMovement: true, zIndex: 90 }
        },
        // Trap blueprints
        spikeTrap: {
            components: [
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#808080', radius: 10 } },
                { name: 'visibility', class: 'VisibilityComponent', args: {} },
                { name: 'trap', class: 'TrapComponent', args: { damage: 15, reusable: true } },
                { name: 'detection', class: 'DetectionComponent', args: { difficulty: 10 } }
            ],
            entityProperties: { blocksMovement: false, isConcealed: true, zIndex: 10 }
        },
        snareTrap: {
            components: [
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#cd853f', radius: 10 } },
                { name: 'visibility', class: 'VisibilityComponent', args: {} },
                { name: 'trap', class: 'TrapComponent', args: { statusEffect: 'snared', duration: 2 } },
                { name: 'detection', class: 'DetectionComponent', args: { difficulty: 12 } }
            ],
            entityProperties: { blocksMovement: false, isConcealed: true, zIndex: 10 }
        },
        poisonDartTrap: {
            components: [
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#9acd32', radius: 10 } },
                { name: 'visibility', class: 'VisibilityComponent', args: {} },
                { name: 'trap', class: 'TrapComponent', args: { statusEffect: 'poisoned', duration: 3, damage: 5 } },
                { name: 'detection', class: 'DetectionComponent', args: { difficulty: 15 } }
            ],
            entityProperties: { blocksMovement: false, isConcealed: true, zIndex: 10 }
        },
        // Interactable blueprints
        campfire: {
            components: [
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#ff4500', radius: 14 } },
                { name: 'visibility', class: 'VisibilityComponent', args: {} },
                { name: 'interactable', class: 'InteractableComponent', args: { effect: 'rest', healAmount: 50 } }
            ],
            entityProperties: { blocksMovement: true, zIndex: 20 }
        },
        portal: {
            components: [
                { name: 'renderable', class: 'RenderableComponent', args: { fillColor: '#9370db', radius: 16 } },
                { name: 'visibility', class: 'VisibilityComponent', args: {} },
                { name: 'portal', class: 'PortalComponent', argsSource: 'entityProperties' }
            ],
            entityProperties: { blocksMovement: false, zIndex: 30 }
        },
    },
    
    aiBehaviors: {
        basicMelee: {
            rules: [
                { action: 'attack', cost: 1, conditions: [{ type: 'inAttackRange' }] },
                { action: 'moveToTarget', cost: 1, conditions: [] }
            ]
        }
    },

    actions: { // Default costs, skills can override
        moveCost: 1,
        attackCost: 1
    }
};

export default CONFIG;
