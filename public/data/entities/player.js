export default {
  player: { // Add this 'player' key
    "type": "player",
    "name": "Adventurer",
    "stats": { 
      "comment": "Player stats are primarily managed by StatsComponent via 'characterData' (attributes, traits, derived stats from game logic/saves). This section in player.json can hold base values if needed for a new character before full calculation, or be minimal if characterData always provides them.",
      "body": 12,
      "mind": 15,
      "instinct": 10,
      "attackPower": 2
    },
    "renderable": {
      "radius": 12,
      "fillColor": "blue",
      "cssClass": "player-visual-main",
      "spriteKey": "player_default_sprite" 
    },
    "movement": {
      "movementRange": 3 
    },
    "skills_template": {
      "comment": "Initial skills for a new player are typically defined in CONFIG.player.initialSkills or loaded from characterData. This could be a template if needed.",
      "initialSkills": ["Strike", "Power Attack"]
    }
    // initialHex is handled by mapConfig.playerStart
    // blocksMovement, isConcealed, zIndex are handled by CONFIG.entityBlueprints.player
  }
}