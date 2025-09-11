
const enemies = {
    goblinScout: {
        type: 'enemy',
        blueprint: 'enemy',
        name: 'Goblin Scout',
        renderable: { fillColor: 'green', radius: 12 },
        stats: {
            hp: 30, mp: 0, ap: 2, attackPower: 8, defense: 2,
            magicAttack: 0, magicDefense: 0, accuracy: 70, evasion: 15,
            critChance: 5, critMultiplier: 1.5, movementRange: 4
        },
        behavior: { type: 'basicMelee' }, // Refers to CONFIG.aiBehaviors
        visibility: { sightRangeFull: 3, sightRangePartial: 5 }
    },
    goblinBrute: {
        type: 'enemy',
        blueprint: 'enemy',
        name: 'Goblin Brute',
        renderable: { fillColor: 'darkred', radius: 18 },
        stats: {
            hp: 80, mp: 0, ap: 3, attackPower: 15, defense: 8,
            magicAttack: 0, magicDefense: 0, accuracy: 65, evasion: 5,
            critChance: 10, critMultiplier: 1.7, movementRange: 3
        },
        behavior: { type: 'basicMelee' },
        visibility: { sightRangeFull: 4, sightRangePartial: 6 }
    },
    playerGhost: {
        type: 'enemy',
        blueprint: 'enemy',
        name: 'Player Ghost',
        renderable: { fillColor: 'purple', radius: 15, opacity: 0.7 },
        // This should dynamically copy player stats/skills for a true "ghost"
        // For now, a placeholder. You'd need a system to clone player data.
        stats: {
            hp: 100, mp: 50, ap: 3, attackPower: 12, defense: 5,
            magicAttack: 10, magicDefense: 8, accuracy: 80, evasion: 10,
            critChance: 10, critMultiplier: 1.5, movementRange: 3
        },
        behavior: { type: 'basicMelee' }, // Or a more complex AI
        visibility: { sightRangeFull: 5, sightRangePartial: 7 }
        // Potentially add skills component here if ghost uses player skills
        // skills: CONFIG.archetypes.warrior.skills // Example: if ghost is always a warrior
    }
};

export default enemies;