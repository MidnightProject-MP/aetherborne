/**
 * Defines an entity's ability to see, used by the VisibilitySystem for Fog of War.
 * @class VisibilityComponent
 */
class VisibilityComponent {
    constructor(config = {}) {
        this.name = 'visibility';
        this.entity = null;

        /** @type {number} The range for full visibility (e.g., seeing entities clearly). */
        this.sightRangeFull = config.sightRangeFull ?? 2;

        /** @type {number} The range for partial visibility (e.g., seeing the map layout). */
        this.sightRangePartial = config.sightRangePartial ?? 4;
    }

    init() {
        // This component is a pure data container.
    }
}

export default VisibilityComponent;