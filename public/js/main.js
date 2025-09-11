import { EventBus } from './eventBus.js';
import { Orchestrator } from './orchestrator.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[Main] DOMContentLoaded event fired. Initializing App.");
    const eventBus = new EventBus();
    const orchestrator = new Orchestrator(eventBus);
    await orchestrator.start();
});
