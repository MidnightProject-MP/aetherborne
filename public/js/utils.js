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
