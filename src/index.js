'use strict';
var ansiEscapes = require('ansi-escapes');
var wrapAnsi = require('wrap-ansi');
var cliCursor = require('./cli-cursor');


function main (stream) {
	var prevLineCount = 0;

	var streamWrite = stream.write;

	var overridenWrite = function (...args) {
		if (prevLineCount)
			render.clear();

		return streamWrite.apply(this, args);
	};

	var render = function () {
		cliCursor.hide();

		if (stream.write !== overridenWrite) {
			streamWrite  = stream.write;
			stream.write = overridenWrite
		}
		  
		var out = [].join.call(arguments, ' ') + '\n';

		out = wrapAnsi(out, process.stdout.columns || 80, {wordWrap: false});

		streamWrite.call(stream, ansiEscapes.eraseLines(prevLineCount) + out);
		
		prevLineCount = out.split('\n').length;
	};

	render.clear = function () {
		streamWrite.call(stream, ansiEscapes.eraseLines(prevLineCount));

		prevLineCount = 0;
	};

	render.done = function () {
		prevLineCount = 0;
		stream.write  = streamWrite;

		cliCursor.show();
	};

	return render;
}

module.exports = main(process.stdout);
module.exports.stderr = main(process.stderr);
module.exports.create = main;
