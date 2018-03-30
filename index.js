'use strict';
const ansiEscapes = require('ansi-escapes');
const cliCursor = require('cli-cursor');
const wrapAnsi = require('wrap-ansi');

const getWidth = stream => {
	const columns = stream.columns;

	if (!columns) {
		return 80;
	}

	// Windows appears to wrap a character early
	// I hate Windows so much
	if (process.platform === 'win32') {
		return columns - 1;
	}

	return columns;
};

const main = (stream, options) => {
	options = Object.assign({
		showCursor: false
	}, options);

	let prevOutput = [];

	const render = function () {
		if (!options.showCursor) {
			cliCursor.hide();
		}

		const thisOutput = [].join.call(arguments, ' ').split('\n').concat(['']);
		let firstDiff = 0;
		// If the new output is shorter than the old, we need to redraw every line
		// (output will "scroll" down); otherwise, find the first differing line
		// and start there.
		if (thisOutput.length >= prevOutput.length) {
			while (firstDiff < thisOutput.length &&
				thisOutput[firstDiff] === prevOutput[firstDiff]) {
				firstDiff++;
			}
		}
		const out = wrapAnsi(thisOutput.slice(firstDiff).join('\n'), getWidth(stream), {
			trim: false,
			hard: true,
			wordWrap: false
		});
		stream.write(ansiEscapes.eraseLines(prevOutput.length - firstDiff) + out);
		prevOutput = thisOutput;
	};

	render.clear = () => {
		stream.write(ansiEscapes.eraseLines(prevOutput.length));
		prevOutput = [];
	};

	render.done = () => {
		prevOutput = [];

		if (!options.showCursor) {
			cliCursor.show();
		}
	};

	return render;
};

module.exports = main(process.stdout);
module.exports.stderr = main(process.stderr);
module.exports.create = main;
