import { EventBus } from './eventBus.js';
import { Orchestrator } from './orchestrator.js';
import HighScoreManager from './high-score-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[Main] DOMContentLoaded event fired. Initializing App.");
    const eventBus = new EventBus();
    // Create an instance of the HighScoreManager.
    const highScoreManager = new HighScoreManager();
    // Inject the instance into the Orchestrator.
    const orchestrator = new Orchestrator(eventBus, highScoreManager);
    await orchestrator.start();
});
