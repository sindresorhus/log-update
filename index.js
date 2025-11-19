import process from 'node:process';
import ansiEscapes from 'ansi-escapes';
import cliCursor from 'cli-cursor';
import wrapAnsi from 'wrap-ansi';
import sliceAnsi from 'slice-ansi';
import stripAnsi from 'strip-ansi';

const getWidth = (stream, defaultWidth) => stream.columns ?? defaultWidth ?? 80;

const fitToTerminalHeight = (stream, wrappedText, defaultHeight) => {
	const terminalHeight = stream.rows ?? defaultHeight ?? 24;
	if (terminalHeight === undefined) {
		return {text: wrappedText, wasClipped: false};
	}

	// Zero height: intentionally produce no output
	if (terminalHeight === 0) {
		return {text: '', wasClipped: wrappedText !== ''};
	}

	const unstyled = stripAnsi(wrappedText);
	const newlineCount = [...unstyled].filter(character => character === '\n').length;
	const linesCount = newlineCount + 1;
	const toRemove = Math.max(0, linesCount - terminalHeight);
	if (toRemove === 0) {
		return {text: wrappedText, wasClipped: false};
	}

	let seen = 0;
	let cut = 0;
	for (const [index, character] of [...unstyled].entries()) {
		if (character === '\n') {
			seen++;
			if (seen === toRemove) {
				cut = index + 1;
				break;
			}
		}
	}

	return {text: sliceAnsi(wrappedText, cut), wasClipped: true};
};

/**
Find common prefix and suffix between frames.
*/
const diffFrames = (previousLines, nextLines) => {
	let start = 0;
	for (; start < previousLines.length && start < nextLines.length; start++) {
		if (previousLines[start] !== nextLines[start]) {
			break;
		}
	}

	let endPrevious = previousLines.length - 1;
	let endNext = nextLines.length - 1;
	while (endPrevious >= start && endNext >= start && previousLines[endPrevious] === nextLines[endNext]) {
		endPrevious--;
		endNext--;
	}

	return {start, endPrevious, endNext};
};

/**
Build a single escape sequence patch to transform previous -> next.
*/
const buildPatch = ({
	prevCount,
	start,
	endPrevious,
	endNext,
	nextLines,
	nextWrappedEndsWithNewline,
}) => {
	let sequence = '';

	// Move cursor up to the first changed line, starting from the trailing blank line.
	const upCount = Math.max(0, prevCount - 1 - start);
	if (upCount > 0) {
		sequence += ansiEscapes.cursorUp(upCount);
	}

	sequence += ansiEscapes.cursorLeft;

	// Clear the changed block from the previous frame.
	const linesToClear = Math.max(0, endPrevious - start + 1);
	for (let index = 0; index < linesToClear; index++) {
		sequence += ansiEscapes.eraseLine;

		if (index < linesToClear - 1) {
			sequence += ansiEscapes.cursorDown();
		}
	}

	if (linesToClear > 1) {
		sequence += ansiEscapes.cursorUp(linesToClear - 1);
	}

	sequence += ansiEscapes.cursorLeft;

	// Write the new changed block.
	const wroteSlice = nextLines.slice(start, endNext + 1);
	if (wroteSlice.length > 0) {
		const chunk = wroteSlice.join('\n');
		sequence += chunk;

		// Ensure we do not leave trailing characters on the last written line
		sequence += ansiEscapes.eraseEndLine;

		if (nextWrappedEndsWithNewline && !chunk.endsWith('\n')) {
			sequence += '\n';
		}
	}

	// Reposition cursor to the final trailing blank line for the next call
	const currentLine = start + wroteSlice.length;
	const finalLine = nextLines.length - 1;
	const downCount = finalLine - currentLine;
	if (downCount > 0) {
		sequence += ansiEscapes.cursorDown(downCount);
	}

	return sequence;
};

export function createLogUpdate(stream, {showCursor = false, defaultWidth, defaultHeight} = {}) {
	let previousLineCount = 0;
	let previousWidth = getWidth(stream, defaultWidth);
	let previousOutput = '';

	/**
	Normalize, wrap, and height-clip into a concrete frame.

	Returns both the wrapped string and an array of lines, where an empty frame (for `rows === 0`) is represented by `lines.length === 0`.
	*/
	const computeFrame = (text, width) => {
		// Preserve user's trailing newlines, ensure at least one
		const textString = String(text);
		const raw = textString.endsWith('\n') ? textString : `${textString}\n`;
		const wrapped = wrapAnsi(raw, width, {trim: false, hard: true, wordWrap: false});
		const {text: clippedText, wasClipped} = fitToTerminalHeight(stream, wrapped, defaultHeight);

		// Derive lines. Special-case empty string to represent 0 lines.
		const lines = clippedText === '' ? [] : clippedText.split('\n');
		return {wrapped: clippedText, lines, wasClipped};
	};

	const reset = () => {
		previousOutput = '';
		previousWidth = getWidth(stream, defaultWidth);
		previousLineCount = 0;
	};

	const render = (...arguments_) => {
		if (!showCursor) {
			cliCursor.hide();
		}

		const width = getWidth(stream, defaultWidth);
		const {wrapped, lines, wasClipped} = computeFrame(arguments_.join(' '), width);

		// If nothing would be written (rows === 0 after clipping), skip I/O but update state.
		if (lines.length === 0) {
			previousOutput = wrapped;
			previousWidth = width;
			previousLineCount = 0;
			return;
		}

		// Fast no-op path
		if (wrapped === previousOutput && previousWidth === width) {
			return;
		}

		// First frame: just write
		if (previousLineCount === 0) {
			stream.write(wrapped);

			previousOutput = wrapped;
			previousWidth = width;
			previousLineCount = lines.length;
			return;
		}

		// Width changed or content clipped: full erase + write (diffing is invalid across wraps/clips)
		if (previousWidth !== width || wasClipped) {
			stream.write(ansiEscapes.eraseLines(previousLineCount) + wrapped);

			previousOutput = wrapped;
			previousWidth = width;
			previousLineCount = lines.length;
			return;
		}

		const previousLines = previousOutput === '' ? [] : previousOutput.split('\n');
		const {start, endPrevious, endNext} = diffFrames(previousLines, lines);

		// If nothing changed (including trailing blank logic), bail
		if (start === lines.length && previousLineCount === lines.length) {
			return;
		}

		// If common prefix length is zero, simpler and correct to full erase.
		if (start === 0) {
			stream.write(ansiEscapes.eraseLines(previousLineCount) + wrapped);

			previousOutput = wrapped;
			previousWidth = width;
			previousLineCount = lines.length;
			return;
		}

		const patch = buildPatch({
			prevCount: previousLineCount,
			start,
			endPrevious,
			endNext,
			nextLines: lines,
			nextWrappedEndsWithNewline: wrapped.endsWith('\n'),
		});

		stream.write(patch);

		previousOutput = wrapped;
		previousWidth = width;
		previousLineCount = lines.length;
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
		if (previousLineCount > 0) {
			stream.write(ansiEscapes.eraseLines(previousLineCount));
			previousLineCount = 0;
		}

		const text = `${arguments_.join(' ')}`;
		const width = getWidth(stream, defaultWidth);
		const {wrapped: wrappedText} = computeFrame(text, width);
		stream.write(wrappedText);

		reset();
	};

	return render;
}

const logUpdate = createLogUpdate(process.stdout);

export default logUpdate;

export const logUpdateStderr = createLogUpdate(process.stderr);
