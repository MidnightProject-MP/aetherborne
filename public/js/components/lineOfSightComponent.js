// import CONFIG from '../config.js';

// /**
//  * Manages an entity's line of sight and field of view.
//  * This component calculates which tiles are visible and publishes an event
//  * when the visibility changes, but does not handle rendering itself.
//  * @class LineOfSightComponent
//  */
// class LineOfSightComponent {
//     constructor(config = {}) {
//         this.name = 'lineOfSight';
//         /** @type {Entity|null} */
//         this.entity = null;

//         /** @type {number} */
//         this.range = config.range || CONFIG.player.visibilityRange || 4;

//         /**
//          * Stores the set of hex coordinates that were visible in the last update
//          * to optimize rendering.
//          * @private
//          * @type {Set<string>}
//          */
//         this.previouslyVisible = new Set();
//     }

//     /**
//      * Initializes the component after being added to an entity.
//      */
//     init() {
//         // Initial computation when the component is first ready.
//         this.computeAndPublish();
//     }

//     /**
//      * Computes the entity's current line of sight and publishes the results.
//      * This is the primary method to be called when the entity moves or the map changes.
//      */
//     computeAndPublish() {
//         if (!this.entity || !this.entity.hex || !this.entity.game.gameMap) return;

//         // In a full implementation, this would use a proper LOS algorithm.
//         // For now, we simulate it by getting tiles in range.
//         const visibleTiles = this.entity.game.gameMap.calculateVisibility(this.entity.hex, this.range);
//         const newVisibleSet = new Set(visibleTiles.map(tile => `${tile.q},${tile.r}`));

//         // Determine which tiles have changed visibility status
//         const newlyVisible = [...newVisibleSet].filter(coord => !this.previouslyVisible.has(coord));
//         const newlyHidden = [...this.previouslyVisible].filter(coord => !newVisibleSet.has(coord));

//         // Only publish an event if something has actually changed
//         if (newlyVisible.length > 0 || newlyHidden.length > 0) {
//             this.entity.game.eventBus.publish('visibilityUpdated', {
//                 entityId: this.entity.id,
//                 visible: newlyVisible, // Array of tile coordinate strings
//                 hidden: newlyHidden    // Array of tile coordinate strings
//             });
            
//             // Update the stored set for the next comparison
//             this.previouslyVisible = newVisibleSet;
//         }
//     }
// }

// export default LineOfSightComponent;
