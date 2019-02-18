'use strict';
const logUpdate = require('.');

const frames = ['-', '\\', '|', '/'];
let i = 0;

setInterval(() => {
	const frame = frames[i = ++i % frames.length];

	logUpdate(`
        ♥♥
   ${frame} unicorns ${frame}
        ♥♥
`);
}, 80);

// Run it with:
// $ node example.js
