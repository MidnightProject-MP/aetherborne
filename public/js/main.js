import { EventBus } from './eventBus.js';
import { Orchestrator } from './orchestrator.js';
import HighScoreManager from './high-score-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[Main] DOMContentLoaded event fired. Initializing App.");
    const eventBus = new EventBus();
    // Inject the HighScoreManager into the Orchestrator to make it available to the core application logic.
    const orchestrator = new Orchestrator(eventBus, HighScoreManager);
    await orchestrator.start();
});
