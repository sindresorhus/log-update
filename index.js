'use strict';
const ansiEscapes = require('ansi-escapes');
const cliCursor = require('cli-cursor');
const wrapAnsi = require('wrap-ansi');
const isWindows = require('is-windows');

const main = stream => {
	let prevLineCount = 0;

	const getWidth = function (columns) {
		// default width to 80 if we can't get column count
		if (!columns) {
			return 80;
		}

		// windows appears to wrap a character early
		if (isWindows()) {
			return columns - 1;
		}

		return columns;
	};

	const render = function () {
		cliCursor.hide();
		let out = [].join.call(arguments, ' ') + '\n';
		out = wrapAnsi(out, getWidth(process.stdout.columns), {hard: true, wordWrap: false});
		stream.write(ansiEscapes.eraseLines(prevLineCount) + out);
		prevLineCount = out.split('\n').length;
	};

	render.clear = () => {
		stream.write(ansiEscapes.eraseLines(prevLineCount));
		prevLineCount = 0;
	};

	render.done = () => {
		prevLineCount = 0;
		cliCursor.show();
	};

	return render;
};

module.exports = main(process.stdout);
module.exports.stderr = main(process.stderr);
module.exports.create = main;
