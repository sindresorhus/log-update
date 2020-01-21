'use strict';
const ansiEscapes = require('ansi-escapes');
const cliCursor = require('cli-cursor');
const wrapAnsi = require('wrap-ansi');

const getWidth = stream => {
	const {columns} = stream;

	if (!columns) {
		return 80;
	}

	return columns;
};

const main = (stream, options) => {
	options = Object.assign({
		showCursor: false
	}, options);

	let prevLineCount = 0;
	let prevOut = '';

	const render = (...args) => {
		if (!options.showCursor) {
			cliCursor.hide();
		}

		let out = args.join(' ') + '\n';
		if (out === prevOut) {
			return;
		}

		prevOut = out;
		out = wrapAnsi(out, getWidth(stream), {
			trim: false,
			hard: true,
			wordWrap: false
		});
		stream.write(ansiEscapes.eraseLines(prevLineCount) + out);
		prevLineCount = out.split('\n').length;
	};

	render.clear = () => {
		stream.write(ansiEscapes.eraseLines(prevLineCount));
		prevOut = '';
		prevLineCount = 0;
	};

	render.done = () => {
		prevOut = '';
		prevLineCount = 0;

		if (!options.showCursor) {
			cliCursor.show();
		}
	};

	return render;
};

module.exports = main(process.stdout);
// TODO: Remove this for the next major release
module.exports.default = module.exports;
module.exports.stderr = main(process.stderr);
module.exports.create = main;
