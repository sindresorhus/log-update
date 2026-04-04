import process from 'node:process';
import ansiEscapes from 'ansi-escapes';
import cliCursor from 'cli-cursor';
import wrapAnsi from 'wrap-ansi';
import sliceAnsi from 'slice-ansi';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';

const getWidth = (stream, defaultWidth) => stream.columns ?? defaultWidth ?? 80;
const SYNCHRONIZED_OUTPUT_ENABLE = '\u001B[?2026h';
const SYNCHRONIZED_OUTPUT_DISABLE = '\u001B[?2026l';
const countLines = text => text.split('\n').length;
const getFrameHeight = text => {
	const unstyledText = stripAnsi(text);
	return unstyledText === '' ? 0 : unstyledText.split('\n').length;
};

const fitToTerminalHeight = (stream, wrappedText, defaultHeight) => {
	const terminalHeight = stream.rows ?? defaultHeight ?? 24;

	// Zero height: intentionally produce no output
	if (terminalHeight === 0) {
		return {text: '', wasClipped: wrappedText !== ''};
	}

	const unstyled = stripAnsi(wrappedText);
	const lines = unstyled.split('\n');
	const toRemove = Math.max(0, lines.length - terminalHeight);
	if (toRemove === 0) {
		return {text: wrappedText, wasClipped: false};
	}

	// Compute visible-column cut to match sliceAnsi's position tracking.
	// sliceAnsi counts each \n as 1 column, but stringWidth returns 0 for \n.
	let cut = 0;
	for (let index = 0; index < toRemove; index++) {
		cut += stringWidth(lines[index]) + 1;
	}

	let clippedText = sliceAnsi(wrappedText, cut);
	let clippedLineCount = getFrameHeight(clippedText);

	// Normalize the estimated cut so it matches sliceAnsi's width model.
	while (clippedLineCount > terminalHeight) {
		cut++;
		clippedText = sliceAnsi(wrappedText, cut);
		clippedLineCount = getFrameHeight(clippedText);
	}

	while (cut > 0) {
		const previousClippedText = sliceAnsi(wrappedText, cut - 1);
		if (getFrameHeight(previousClippedText) > terminalHeight) {
			break;
		}

		cut--;
		clippedText = previousClippedText;
	}

	return {text: clippedText, wasClipped: cut > 0};
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

	// Move cursor from the trailing blank line to the first changed line.
	const cursorLine = prevCount - 1;
	const cursorLineDelta = start - cursorLine;
	if (cursorLineDelta > 0) {
		sequence += ansiEscapes.cursorDown(cursorLineDelta);
	}

	if (cursorLineDelta < 0) {
		sequence += ansiEscapes.cursorUp(-cursorLineDelta);
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
	let writtenLineBreakCount = 0;
	if (wroteSlice.length > 0) {
		const chunk = wroteSlice.join('\n');
		const shouldWriteTrailingNewline = nextWrappedEndsWithNewline
			&& endNext < nextLines.length - 1
			&& !chunk.endsWith('\n');

		sequence += chunk;
		writtenLineBreakCount = countLines(chunk) - 1;

		// Ensure we do not leave trailing characters on the last written line
		sequence += ansiEscapes.eraseEndLine;

		if (shouldWriteTrailingNewline) {
			sequence += '\n';
			writtenLineBreakCount++;
		}
	}

	// Reposition cursor to the final trailing blank line for the next call
	const currentLine = start + writtenLineBreakCount;
	const finalLine = nextLines.length - 1;
	const lineDelta = finalLine - currentLine;
	if (lineDelta > 0) {
		sequence += ansiEscapes.cursorDown(lineDelta);
	}

	if (lineDelta < 0) {
		sequence += ansiEscapes.cursorUp(-lineDelta);
	}

	return sequence;
};

export function createLogUpdate(stream, {showCursor = false, defaultWidth, defaultHeight} = {}) {
	let previousLineCount = 0;
	let previousWidth = getWidth(stream, defaultWidth);
	let previousOutput = '';
	const useSynchronizedOutput = stream.isTTY === true;

	const write = output => {
		if (output === '') {
			return;
		}

		if (useSynchronizedOutput) {
			stream.write(SYNCHRONIZED_OUTPUT_ENABLE + output + SYNCHRONIZED_OUTPUT_DISABLE);
			return;
		}

		stream.write(output);
	};

	/**
	Normalize, wrap, and height-clip into a concrete frame.

	Returns both the wrapped string and an array of lines, where an empty frame (for `rows === 0`) is represented by `lines.length === 0`.
	*/
	const computeFrame = (text, width, clipToHeight = true) => {
		// Preserve user's trailing newlines, ensure at least one
		const textString = String(text);
		const raw = textString.endsWith('\n') ? textString : `${textString}\n`;
		const wrapped = wrapAnsi(raw, width, {trim: false, hard: true, wordWrap: false});
		const {text: frameText, wasClipped} = clipToHeight ? fitToTerminalHeight(stream, wrapped, defaultHeight) : {text: wrapped, wasClipped: false};

		// Derive lines. Special-case empty string to represent 0 lines.
		const lines = frameText === '' ? [] : frameText.split('\n');
		return {wrapped: frameText, lines, wasClipped};
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

		// If nothing would be written (rows === 0 after clipping), erase previous output and update state.
		if (lines.length === 0) {
			if (previousLineCount > 0) {
				write(ansiEscapes.eraseLines(previousLineCount));
			}

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
			write(wrapped);

			previousOutput = wrapped;
			previousWidth = width;
			previousLineCount = lines.length;
			return;
		}

		// Width changed or content clipped: full erase + write (diffing is invalid across wraps/clips)
		if (previousWidth !== width || wasClipped) {
			write(ansiEscapes.eraseLines(previousLineCount) + wrapped);

			previousOutput = wrapped;
			previousWidth = width;
			previousLineCount = lines.length;
			return;
		}

		const previousLines = previousOutput === '' ? [] : previousOutput.split('\n');
		let {start, endPrevious, endNext} = diffFrames(previousLines, lines);

		// When lines are inserted or removed, the suffix shifts position.
		// Include it in the rewrite so it renders at the correct row.
		if (previousLines.length !== lines.length) {
			endPrevious = previousLines.length - 1;
			endNext = lines.length - 1;
		}

		// If nothing changed (including trailing blank logic), bail
		if (start === lines.length && previousLineCount === lines.length) {
			return;
		}

		// If common prefix length is zero, simpler and correct to full erase.
		if (start === 0) {
			write(ansiEscapes.eraseLines(previousLineCount) + wrapped);

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

		write(patch);

		previousOutput = wrapped;
		previousWidth = width;
		previousLineCount = lines.length;
	};

	render.clear = () => {
		write(ansiEscapes.eraseLines(previousLineCount));
		reset();
	};

	render.done = () => {
		reset();
		if (!showCursor) {
			cliCursor.show();
		}
	};

	render.persist = (...arguments_) => {
		const erasePrevious = previousLineCount > 0 ? ansiEscapes.eraseLines(previousLineCount) : '';
		const width = getWidth(stream, defaultWidth);
		const {wrapped: wrappedText} = computeFrame(arguments_.join(' '), width, false);
		write(erasePrevious + wrappedText);

		reset();
	};

	return render;
}

const logUpdate = createLogUpdate(process.stdout);

export default logUpdate;

export const logUpdateStderr = createLogUpdate(process.stderr);
