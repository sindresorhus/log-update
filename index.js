import process from 'node:process';
import ansiEscapes from 'ansi-escapes';
import cliCursor from 'cli-cursor';
import wrapAnsi from 'wrap-ansi';
import sliceAnsi from 'slice-ansi';
import stripAnsi from 'strip-ansi';

const getWidth = (stream, defaultWidth) => stream.columns ?? defaultWidth ?? 80;

const fitToTerminalHeight = (stream, text, defaultHeight) => {
	const terminalHeight = stream.rows ?? defaultHeight ?? 24;
	const lines = text.split('\n');
	const toRemove = Math.max(0, lines.length - terminalHeight);
	return toRemove ? sliceAnsi(text, stripAnsi(lines.slice(0, toRemove).join('\n')).length + 1) : text;
};

export function createLogUpdate(stream, {showCursor = false, defaultWidth, defaultHeight} = {}) {
	let previousLineCount = 0;
	let previousWidth = getWidth(stream, defaultWidth);
	let previousOutput = '';

	const reset = () => {
		previousOutput = '';
		previousWidth = getWidth(stream, defaultWidth);
		previousLineCount = 0;
	};

	const render = (...arguments_) => {
		if (!showCursor) {
			cliCursor.hide();
		}

		let output = fitToTerminalHeight(stream, arguments_.join(' ') + '\n', defaultHeight);
		const width = getWidth(stream, defaultWidth);

		if (output === previousOutput && previousWidth === width) {
			return;
		}

		previousOutput = output;
		previousWidth = width;
		output = wrapAnsi(output, width, {trim: false, hard: true, wordWrap: false});

		stream.write(ansiEscapes.eraseLines(previousLineCount) + output);
		previousLineCount = output.split('\n').length;
	};

	render.clear = () => {
		stream.write(ansiEscapes.eraseLines(previousLineCount));
		reset();
	};

	render.done = () => {
		reset();
		if (!showCursor) {
			cliCursor.show();
		}
	};

	render.persist = (...arguments_) => {
		// Clear any existing update first
		if (previousLineCount > 0) {
			stream.write(ansiEscapes.eraseLines(previousLineCount));
			previousLineCount = 0;
		}

		// Write directly to stream without height fitting
		const text = arguments_.join(' ') + '\n';
		const width = getWidth(stream, defaultWidth);
		const wrappedText = wrapAnsi(text, width, {trim: false, hard: true, wordWrap: false});
		stream.write(wrappedText);

		// Reset state since we're no longer tracking this output
		reset();
	};

	return render;
}

const logUpdate = createLogUpdate(process.stdout);
export default logUpdate;

export const logUpdateStderr = createLogUpdate(process.stderr);
