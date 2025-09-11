// public/data/entities/index.js

import player from './player.js';
import enemies from './enemies.js';
import traps from './traps.js';
import interactables from './interactables.js';

// Consolidate all entity definitions
const entityDefinitions = {
    ...player,
    ...enemies,
    ...traps,
    ...interactables,
};

export default entityDefinitions;
