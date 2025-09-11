const interactables = {
    campfire: {
        type: 'campfire',
        blueprint: 'campfire',
        name: 'Campfire',
        renderable: { fillColor: 'orange', radius: 15, strokeColor: 'red', strokeWidth: 2, shape: 'star' },
        // Campfire-specific properties
        interactEffect: { type: 'rest', healAmount: 50, restoreMP: 100 },
        visibility: { sightRangeFull: 5, sightRangePartial: 7 }
    },
    portal: {
        type: 'portal',
        blueprint: 'portal',
        name: 'Portal',
        renderable: { fillColor: 'cyan', radius: 20, strokeColor: 'blue', strokeWidth: 3, shape: 'hexagon' },
        // nextMapId will be set dynamically from map config
        visibility: { sightRangeFull: 5, sightRangePartial: 7 }
    }
};

export default interactables;