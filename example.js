import logUpdate from './index.js';

const frames = ['-', '\\', '|', '/'];
let index = 0;

setInterval(() => {
	const frame = frames[index = ++index % frames.length];

	logUpdate(`
        ♥♥
   ${frame} unicorns ${frame}
        ♥♥
`);
}, 80);

// Run it with:
// $ node example.js
