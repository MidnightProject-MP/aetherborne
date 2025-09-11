/**
 * Represents a 2D point in pixel space.
 * @class Point
 */
export class Point {
    /**
     * @param {number} x - The x-coordinate.
     * @param {number} y - The y-coordinate.
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

/**
 * Represents a single hexagonal tile in the game world, using axial coordinates.
 * It holds both its geometric position and its game-specific state.
 * @class Tile
 */
export class Tile {
    /**
     * @param {number} q - The q coordinate (column).
     * @param {number} r - The r coordinate (row).
     * @param {number} s - The s coordinate (must satisfy q + r + s === 0).
     * @param {object} [options={}] - Optional game-specific properties for the tile.
     */
    constructor(q, r, s, options = {}) {
        if (Math.round(q + r + s) !== 0) throw "q + r + s must be 0 for a Tile";

        /** @type {number} */
        this.q = q;
        /** @type {number} */
        this.r = r;
        /** @type {number} */
        this.s = s;
        
        // Game-specific properties
        /** @type {boolean} */
        this.isObstacle = options.isObstacle || false;
        /** @type {boolean} */
        this.isPortal = options.isPortal || false;
        /** @type {boolean} */
        this.isTrap = options.isTrap || false;
        /** @type {boolean} */
        this.isTreasure = options.isTreasure || false;
        /** @type {string} 'hidden', 'partial', or 'full' */
        this.visibility = options.visibility || 'hidden';

        // Pathfinding properties
        /** @type {Tile|null} */
        this.cameFrom = options.cameFrom || null;
        /** @type {number} */
        this.gScore = options.gScore || Infinity;
        /** @type {number} */
        this.fScore = options.fScore || Infinity;
    }

    /**
     * Checks if this tile has the same coordinates as another tile.
     * @param {Tile} otherTile - The tile to compare against.
     * @returns {boolean}
     */
    equals(otherTile) {
        if (!otherTile) return false;
        return this.q === otherTile.q && this.r === otherTile.r && this.s === otherTile.s;
    }
    
    /**
     * @returns {string} A string representation of the tile's coordinates.
     */
    toString() {
        return `Tile(${this.q}, ${this.r}, ${this.s})`;
    }

    // --- Pure Hexagonal Geometry Methods ---

    add(b) { return new Tile(this.q + b.q, this.r + b.r, this.s + b.s); }
    subtract(b) { return new Tile(this.q - b.q, this.r - b.r, this.s - b.s); }
    scale(k) { return new Tile(this.q * k, this.r * k, this.s * k); }
    rotateLeft() { return new Tile(-this.s, -this.q, -this.r); }
    rotateRight() { return new Tile(-this.r, -this.s, -this.q); }
    
    /**
     * Gets the tile vector for a given direction index (0-5).
     * @param {number} directionIndex 
     * @returns {Tile}
     */
    static direction(directionIndex) { return Tile.directions[directionIndex]; }

    /**
     * Calculates the neighboring tile in a specific direction.
     * @param {number} directionIndex 
     * @returns {Tile}
     */
    neighbor(directionIndex) { return this.add(Tile.direction(directionIndex)); }

    len() { return (Math.abs(this.q) + Math.abs(this.r) + Math.abs(this.s)) / 2; }
    distance(b) { return this.subtract(b).len(); }
    
    round() {
        let qi = Math.round(this.q);
        let ri = Math.round(this.r);
        let si = Math.round(this.s);
        const q_diff = Math.abs(qi - this.q);
        const r_diff = Math.abs(ri - this.r);
        const s_diff = Math.abs(si - this.s);
        if (q_diff > r_diff && q_diff > s_diff) {
            qi = -ri - si;
        } else if (r_diff > s_diff) {
            ri = -qi - si;
        } else {
            si = -qi - ri;
        }
        return new Tile(qi, ri, si);
    }

    /**
     * Performs linear interpolation between two hexes.
     * @param {Tile} a - The starting hex.
     * @param {Tile} b - The ending hex.
     * @param {number} t - The interpolation factor (0.0 to 1.0).
     * @returns {Tile} A new Tile representing the interpolated coordinates.
     */
    static lerp(a, b, t) {
        return new Tile(
            a.q * (1 - t) + b.q * t,
            a.r * (1 - t) + b.r * t,
            a.s * (1 - t) + b.s * t
        );
    }
    
    /**
     * Returns an array of hexes forming a line between two hexes.
     * @param {Tile} a - The starting hex.
     * @param {Tile} b - The ending hex.
     * @returns {Array<Tile>} An array of rounded Tile coordinates on the line.
     */
    static line(a, b) {
        const N = a.distance(b);
        if (N === 0) return [a];
        return Array.from({ length: N + 1 }, (_, i) => Tile.lerp(a, b, i / N).round());
    }

}

// Static properties for Tile geometry
Tile.directions = [new Tile(1, 0, -1), new Tile(1, -1, 0), new Tile(0, -1, 1), new Tile(-1, 0, 1), new Tile(-1, 1, 0), new Tile(0, 1, -1)];
Tile.diagonals = [new Tile(2, -1, -1), new Tile(1, -2, 1), new Tile(-1, -1, 2), new Tile(-2, 1, 1), new Tile(-1, 2, -1), new Tile(1, 1, -2)];

/**
 * Defines the orientation, size, and origin for converting between hex and pixel coordinates.
 * @class Layout
 */
export class Layout {
    /**
     * @param {Orientation} orientation - The orientation of the hex grid (pointy or flat).
     * @param {Point} size - The size of each hex in pixels.
     * @param {Point} origin - The pixel offset for the grid's origin (0,0,0).
     */
    constructor(orientation, size, origin) {
        this.orientation = orientation;
        this.size = size;
        this.origin = origin;
        
        // Pre-calculate the points for a single hex polygon, scaled and ready for use.
        // This avoids recalculation and makes rendering more efficient.
        const corner_offsets = this._polygonCornerOffsets();
        /** @type {string} A string of points for an SVG polygon element (e.g., "x1,y1 x2,y2 ..."). */
        this.polygonPoints = corner_offsets.map(p => `${p.x},${p.y}`).join(' ');

    }

    /**
     * Converts a Tile's axial coordinates to pixel coordinates.
     * @param {Tile} h - The tile to convert.
     * @returns {Point} The pixel coordinates of the tile's center.
     */
    hexToPixel(h) {
        const M = this.orientation;
        const x = (M.f0 * h.q + M.f1 * h.r) * this.size.x;
        const y = (M.f2 * h.q + M.f3 * h.r) * this.size.y;
        return new Point(x + this.origin.x, y + this.origin.y);
    }

    /**
     * Converts pixel coordinates to the containing Tile's fractional axial coordinates.
     * @param {Point} p - The pixel coordinates to convert.
     * @returns {Tile} A new Tile with fractional coordinates (needs to be rounded).
     */
    pixelToHex(p) {
        const M = this.orientation;
        const pt = new Point((p.x - this.origin.x) / this.size.x, (p.y - this.origin.y) / this.size.y);
        const q = M.b0 * pt.x + M.b1 * pt.y;
        const r = M.b2 * pt.x + M.b3 * pt.y;
        return new Tile(q, r, -q - r);
    }

    /**
     * Calculates the pixel coordinates of a hex's corners.
     * @param {Tile} h - The tile.
     * @returns {Point[]} An array of 6 corner points.
     */
    polygonCorners(h) {
        const corners = [];
        const center = this.hexToPixel(h);
        for (let i = 0; i < 6; i++) {
            const offset = this._hexCornerOffset(i);
            corners.push(new Point(center.x + offset.x, center.y + offset.y));
        }
        return corners;
    }

    /** @private */
    _hexCornerOffset(corner) {
        const M = this.orientation;
        const angle = 2.0 * Math.PI * (M.start_angle - corner) / 6.0;
        return new Point(this.size.x * Math.cos(angle), this.size.y * Math.sin(angle));
    }

        /**
     * Calculates the corner offsets for a hex polygon, which can be used to draw it.
     * @returns {Point[]} An array of 6 corner points relative to a hex's center.
     * @private
     */
    _polygonCornerOffsets() {
        const corners = [];
        for (let i = 0; i < 6; i++) {
            corners.push(this._hexCornerOffset(i));
        }
        return corners;
    }

}

/**
 * Represents the orientation matrix for the hex grid layout.
 * @class Orientation
 */
export class Orientation {
    constructor(f0, f1, f2, f3, b0, b1, b2, b3, start_angle) {
        this.f0 = f0; this.f1 = f1; this.f2 = f2; this.f3 = f3;
        this.b0 = b0; this.b1 = b1; this.b2 = b2; this.b3 = b3;
        this.start_angle = start_angle;
    }
}

Layout.pointy = new Orientation(Math.sqrt(3.0), Math.sqrt(3.0) / 2.0, 0.0, 3.0 / 2.0, Math.sqrt(3.0) / 3.0, -1.0 / 3.0, 0.0, 2.0 / 3.0, 0.5);
Layout.flat = new Orientation(3.0 / 2.0, 0.0, Math.sqrt(3.0) / 2.0, Math.sqrt(3.0), 2.0 / 3.0, 0.0, -1.0 / 3.0, Math.sqrt(3.0) / 3.0, 0.0);


// --- Tests (Kept for self-verification) ---
class Tests {
    static testAll() {
        Tests.testTileArithmetic();
        Tests.testTileDirection();
        Tests.testTileNeighbor();
        Tests.testTileDistance();
        Tests.testTileRound();
        Tests.testTileLinedraw();
        Tests.testLayout();
    }
    static equalTile(name, a, b) { if (!(a.q === b.q && a.s === b.s && a.r === b.r)) complain(name); }
    static equalInt(name, a, b) { if (!(a === b)) complain(name); }
    static equalTileArray(name, a, b) { Tests.equalInt(name, a.length, b.length); for (let i = 0; i < a.length; i++) { Tests.equalTile(name, a[i], b[i]); } }
    static testTileArithmetic() { Tests.equalTile("tile_add", new Tile(4, -10, 6), new Tile(1, -3, 2).add(new Tile(3, -7, 4))); Tests.equalTile("tile_subtract", new Tile(-2, 4, -2), new Tile(1, -3, 2).subtract(new Tile(3, -7, 4))); }
    static testTileDirection() { Tests.equalTile("tile_direction", new Tile(0, -1, 1), Tile.direction(2)); }
    static testTileNeighbor() { Tests.equalTile("tile_neighbor", new Tile(1, -3, 2), new Tile(1, -2, 1).neighbor(2)); }
    static testTileDistance() { Tests.equalInt("tile_distance", 7, new Tile(3, -7, 4).distance(new Tile(0, 0, 0))); }
    static testTileRound() { const a = new Tile(0, 0, 0); const b = new Tile(1, -1, 0); Tests.equalTile("tile_round 1", new Tile(5, -10, 5), Tile.lerp(new Tile(0,0,0), new Tile(10,-20,10), 0.5).round()); Tests.equalTile("tile_round 2", a.round(), Tile.lerp(a, b, 0.499).round()); }
    static testTileLinedraw() { Tests.equalTileArray("tile_linedraw", [new Tile(0, 0, 0), new Tile(0, -1, 1), new Tile(0, -2, 2), new Tile(1, -3, 2), new Tile(1, -4, 3), new Tile(1, -5, 4)], Tile.line(new Tile(0, 0, 0), new Tile(1, -5, 4))); }
    static testLayout() { const h = new Tile(3, 4, -7); const flat = new Layout(Layout.flat, new Point(10, 15), new Point(35, 71)); Tests.equalTile("layout", h, flat.pixelToHex(flat.hexToPixel(h)).round()); }
}
function complain(name) { console.log("FAIL", name); }
Tests.testAll();
