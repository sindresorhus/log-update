'use strict';
const ansiEscapes = require('ansi-escapes');
const cliCursor = require('cli-cursor');
const splitLines = require('split-lines');
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

	let prevLines = [];

	const render = function () {
		if (!options.showCursor) {
			cliCursor.hide();
		}

		let out = [].join.call(arguments, ' ') + '\n';
		out = wrapAnsi(out, getWidth(stream), {
			trim: false,
			hard: true,
			wordWrap: false
		});
		const lines = splitLines(out, {preserveNewlines: true});
		const unchangedLinesCount = getUnchangedLinesCount(prevLines, lines);
		const diffOut = lines.slice(unchangedLinesCount).join('');
		stream.write(ansiEscapes.eraseLines(prevLines.length - unchangedLinesCount) + diffOut);
		prevLines = lines;
	};

	render.clear = () => {
		stream.write(ansiEscapes.eraseLines(prevLines.length));
		prevLines = [];
	};

	render.done = () => {
		prevLines = [];

		if (!options.showCursor) {
			cliCursor.show();
		}
	};

	return render;
};

function getUnchangedLinesCount(prevLines, lines) {
	for (let i = 0; i < lines.length; i++) {
		if (prevLines[i] !== lines[i]) {
			return i;
		}
	}
	return lines.length;
}

module.exports = main(process.stdout);
module.exports.stderr = main(process.stderr);
module.exports.create = main;
