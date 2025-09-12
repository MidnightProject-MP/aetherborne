/**
 * Generates a standard Version 4 UUID (Universally Unique Identifier).
 * This uses the built-in, cryptographically secure Web Crypto API,
 * which is the modern standard for generating UUIDs in the browser.
 * @returns {string} A new UUID, for example: "36b8f84d-df4e-4d49-b662-bcde71a8764f"
 */
export function generateUUID() {
    return crypto.randomUUID();
}

/**
 * Performs linear interpolation between two numbers.
 * @param {number} a - The starting value.
 * @param {number} b - The ending value.
 * @param {number} t - The interpolation factor (a value between 0 and 1).
 * @returns {number} The interpolated value.
 */
export function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

/**
 * Creates a seeded pseudo-random number generator (PRNG) using the Mulberry32 algorithm.
 * This ensures that for the same seed, the sequence of "random" numbers will always be the same,
 * which is critical for replay validation.
 * @param {string} seed - The string to use as the seed.
 * @returns {function(): number} A function that, when called, returns the next number in the sequence.
 */
export function createSeededRNG(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    }
    return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
}
