'use strict';
const ansiEscapes = require('ansi-escapes');
const cliCursor = require('cli-cursor');
const wrapAnsi = require('wrap-ansi');

const main = (stream, options) => {
	options = Object.assign({
		showCursor: false
	}, options);

	let prevLineCount = 0;

	const render = function () {
		if (!options.showCursor) {
			cliCursor.hide();
		}

		let out = [].join.call(arguments, ' ') + '\n';
		out = wrapAnsi(out, process.stdout.columns || 80, {wordWrap: false, trim: false, hard: true});
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
