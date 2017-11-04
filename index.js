'use strict';
const ansiEscapes = require('ansi-escapes');
const cliCursor = require('cli-cursor');
const wrapAnsi = require('wrap-ansi');

const main = (stream, options) => {
	options = Object.assign({
		showCursor: false
	}, options);

	let prevLineCount = 0;

	const getWidth = function (columns) {
		// Default width to 80 if we can't get column count
		if (!columns) {
			return 80;
		}

		// Windows appears to wrap a character early
		if (process.platform === 'win32') {
			return columns - 1;
		}

		return columns;
	};

	const render = function () {
		if (!options.showCursor) {
			cliCursor.hide();
		}

		let out = [].join.call(arguments, ' ') + '\n';
		out = wrapAnsi(out, getWidth(process.stdout.columns), {trim: false, hard: true, wordWrap: false});
		stream.write(ansiEscapes.eraseLines(prevLineCount) + out);
		prevLineCount = out.split('\n').length;
	};

	render.clear = () => {
		stream.write(ansiEscapes.eraseLines(prevLineCount));
		prevLineCount = 0;
	};

	render.done = () => {
		prevLineCount = 0;

		if (!options.showCursor) {
			cliCursor.show();
		}
	};

	return render;
};

module.exports = main(process.stdout);
module.exports.stderr = main(process.stderr);
module.exports.create = main;
