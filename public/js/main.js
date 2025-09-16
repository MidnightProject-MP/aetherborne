import { EventBus } from './eventBus.js';
import { LiveGameOrchestrator } from './orchestrator.js';
import HighScoreManager from './high-score-manager.js';
import OverlayManager from './ui/overlay-manager.js'; // Import OverlayManager

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[Main] DOMContentLoaded event fired. Initializing App.");
    const eventBus = new EventBus();
    // Create an instance of the HighScoreManager.
    const highScoreManager = new HighScoreManager();
    // Create an instance of the OverlayManager to handle all popups and modals.
    const overlayManager = new OverlayManager(eventBus);

    // Inject the instance into the Orchestrator.
    const orchestrator = new LiveGameOrchestrator(eventBus, highScoreManager);
    await orchestrator.start();
});
