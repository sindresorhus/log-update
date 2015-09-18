'use strict';
var ansiEscapes = require('ansi-escapes');
var cliCursor = require('cli-cursor');

function main(stream) {
	var prevLineCount = 0;

	var render = function () {
		cliCursor.hide();
		var out = [].join.call(arguments, ' ') + '\n';
		stream.write(ansiEscapes.eraseLines(prevLineCount) + out);
		prevLineCount = out.split('\n').length;
	};

	render.clear = function () {
		prevLineCount = 0;
		stream.write(ansiEscapes.eraseLines(prevLineCount + 1));
	};

	render.done = function () {
		prevLineCount = 0;
		stream.write('\n');
	};

	return render;
}

module.exports = main(process.stdout);
module.exports.stderr = main(process.stderr);
module.exports.create = main;
