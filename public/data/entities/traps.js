const traps = {
    spikeTrap: {
        type: 'trap',
        blueprint: 'trap',
        name: 'Spike Trap',
        renderable: { fillColor: 'brown', radius: 8, strokeColor: 'black', strokeWidth: 1, shape: 'triangle' },
        // Trap-specific properties
        trapEffect: { type: 'damage', amount: 10, damageType: 'physical' },
        trigger: 'onEnter', // 'onEnter', 'onStepOff'
        detection: { detectionDifficulty: 10 }, // New: Detection difficulty for this trap
        reusable: false,
        visibility: { sightRangeFull: 0, sightRangePartial: 0 } // Traps are usually not visible until triggered or detected
    },
    snareTrap: {
        type: 'trap',
        blueprint: 'trap',
        name: 'Snare Trap',
        renderable: { fillColor: 'lightgreen', radius: 10, strokeColor: 'darkgreen', strokeWidth: 1, shape: 'circle' },
        trapEffect: { type: 'status', statusId: 'snared', duration: 1, apLoss: 2 }, // Snared status, lose AP
        trigger: 'onEnter',
        reusable: false,
        detection: { detectionDifficulty: 15 },
        visibility: { sightRangeFull: 0, sightRangePartial: 0 }
    },
    poisonDartTrap: {
        type: 'trap',
        blueprint: 'trap',
        name: 'Poison Dart Trap',
        renderable: { fillColor: 'purple', radius: 10, strokeColor: 'black', strokeWidth: 1, shape: 'square' },
        trapEffect: { type: 'status', statusId: 'poisoned', duration: 3, damagePerTurn: 5 }, // Poisoned status
        trigger: 'onEnter',
        reusable: false,
        detection: { detectionDifficulty: 20 },
        visibility: { sightRangeFull: 0, sightRangePartial: 0 }
    }
};

export default traps;