/**
 * A simple publish/subscribe implementation for decoupling components.
 * @class EventBus
 */
export class EventBus {
    constructor() {
        /** @private */
        this.subscriptions = {};
    }

    /**
     * Subscribes a callback function to a specific event.
     * @param {string} event - The name of the event to subscribe to.
     * @param {function} callback - The function to call when the event is published.
     */
    subscribe(event, callback) {
        if (!this.subscriptions[event]) {
            this.subscriptions[event] = [];
        }
        this.subscriptions[event].push(callback);
        console.log(`[EventBus] Subscribed to event: ${event}`, callback); // ADDED LOGGING
    }

    /**
     * Unsubscribes a callback function from a specific event.
     * @param {string} event - The name of the event to unsubscribe from.
     * @param {function} callback - The function to remove from the event's subscribers.
     */
    unsubscribe(event, callback) {
        if (this.subscriptions[event]) {
            this.subscriptions[event] = this.subscriptions[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Publishes an event, calling all subscribed callback functions.
     * @param {string} event - The name of the event to publish.
     * @param {any} payload - The data to pass to the subscribed callback functions.
     */
    publish(event, payload) {
        console.log(`[EventBus] Event published: ${event}`, payload); // ADDED LOGGING

        if (this.subscriptions[event]) {
            this.subscriptions[event].forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`[EventBus] Error in callback for event "${event}":`, error);
                }
            });
        }
    }
}
