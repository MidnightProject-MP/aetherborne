import { EventBus } from './eventBus.js';
import { ReplayOrchestrator } from './ReplayOrchestrator.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[ReplayMain] DOMContentLoaded event fired. Initializing Replay Viewer.");
    const eventBus = new EventBus();
    const replayOrchestrator = new ReplayOrchestrator(eventBus);
    await replayOrchestrator.start();
});