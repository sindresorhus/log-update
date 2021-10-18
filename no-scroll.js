import logUpdate from './index.js';

let y = 0;
let dy = 1.2;
const HEIGHT = 50;

setInterval(() => {
	y += dy;
	if (y < 0) {
		y = -y;
		dy = -dy;
	}

	if (y >= HEIGHT) {
		y = (HEIGHT * 2) - y;
		dy = -dy;
	}

	const iy = Math.floor(y);

	logUpdate(Array.from({length: HEIGHT}).fill().map((_, i) => `${i === iy ? '⇛' : ' '}${i}`).join('\n'));
}, 80);

// Run it with:
// $ node no-scroll.js
//
// Run this in a terminal with fewer than 50 lines and after terminating with ctrl-c, note that
// the scrollback buffer is not polluted with long lists of numbers that had scrolled off the
// top of the terminal.
