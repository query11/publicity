// Print stage/script.js (window.NARRATION) as JSON, for tools/voice.py.
global.window = {};
require('../stage/script.js');
process.stdout.write(JSON.stringify(window.NARRATION));
