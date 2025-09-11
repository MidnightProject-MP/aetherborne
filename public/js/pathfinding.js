/**
 * A simple Priority Queue implementation used by the A* algorithm
 * to efficiently retrieve the node with the lowest cost.
 * @note For large maps, this could be optimized by using a Min-Heap data structure
 * instead of sorting the array on every insertion.
 * @class PriorityQueue
 */
class PriorityQueue {
    constructor() {
        /** @private */
        this.elements = [];
    }

    /**
     * Adds an item to the queue with a given priority.
     * @param {*} item - The item to add to the queue.
     * @param {number} priority - The priority of the item (lower is better).
     */
    enqueue(item, priority) {
        this.elements.push({ item, priority });
        // Sorting on each push is simple but can be inefficient.
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Removes and returns the item with the highest priority (lowest priority value).
     * @returns {*} The item with the highest priority.
     */
    dequeue() {
        return this.elements.shift().item;
    }

    /**
     * Checks if the queue is empty.
     * @returns {boolean}
     */
    isEmpty() {
        return this.elements.length === 0;
    }
}

/**
 * Implements Dijkstra's algorithm to find the shortest path from a start tile
 * to all other reachable tiles on the map.
 * This function does not return a path directly. Instead, it populates the `cameFrom`
 * and `gScore` properties on every reachable Tile instance within the `gameMap`.
 * A path can then be reconstructed by following the `cameFrom` references from a
 * target tile back to the start.
 * @param {Tile} startTile - The starting tile for the pathfinding calculation.
 * @param {GameMap} gameMap - The game map instance containing all tiles.
 */
function aStarAll(startTile, gameMap) {
    if (!startTile || !gameMap) {
        console.error("aStarAll requires a valid startTile and gameMap.");
        return;
    }

    // Reset pathfinding data on all tiles for a fresh calculation.
    for (const tile of gameMap.getAllTiles()) {
        tile.gScore = Infinity;
        tile.cameFrom = null;
    }

    const openSet = new PriorityQueue();
    openSet.enqueue(startTile, 0);

    startTile.gScore = 0;

    while (!openSet.isEmpty()) {
        const currentTile = openSet.dequeue();

        // The pathfinding should ask the map for valid neighbors.
        // This decouples the algorithm from the map's boundary logic.
        const neighbors = gameMap.getWalkableNeighbors(currentTile);
        for (const neighbor of neighbors) {
            const tentativeGScore = currentTile.gScore + 1; // Assuming cost is always 1

            if (tentativeGScore < neighbor.gScore) {
                neighbor.cameFrom = currentTile;
                neighbor.gScore = tentativeGScore;
                
                // For this algorithm, the fScore (priority) is just the gScore.
                // In a true A* implementation, it would be gScore + heuristic.
                openSet.enqueue(neighbor, tentativeGScore);
            }
        }
    }
}

export { aStarAll };
