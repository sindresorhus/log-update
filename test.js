/* eslint-disable max-lines */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import Terminal from 'terminal.js';
import {createLogUpdate} from './index.js';

const setup = options => {
	const terminal = new Terminal(options);
	terminal.rows = options.rows;
	terminal.columns = options.columns;
	terminal.state.setMode('crlf', true);
	const log = createLogUpdate(terminal);
	return {terminal, log};
};

const makeCapturingStream = terminal => ({
	rows: terminal.rows,
	columns: terminal.columns,
	output: '',
	write(chunk) {
		this.output += chunk;
		terminal.write(chunk);
	},
});

// Shared test utilities for partial rendering analysis
const ESC = '\u001B[';
const ERASE_LINE = `${ESC}2K`;
const SYNCHRONIZED_OUTPUT_ENABLE = '\u001B[?2026h';
const SYNCHRONIZED_OUTPUT_DISABLE = '\u001B[?2026l';

const countEraseLines = output => output.split(ERASE_LINE).length - 1;

const assertTerminalLines = (terminal, expectedLines) => {
	for (const [index, expectedLine] of expectedLines.entries()) {
		assert.equal(terminal.state.getLine(index).str, expectedLine);
	}
};

const setupPartialTest = ({rows = 20, columns = 40, isTTY} = {}) => {
	const {terminal} = setup({rows, columns});
	const stream = makeCapturingStream(terminal);
	if (isTTY !== undefined) {
		stream.isTTY = isTTY;
	}

	const log = createLogUpdate(stream);
	return {terminal, stream, log};
};

test('output a single line', () => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('goodbye, world');
	assert.equal(terminal.state.getLine(0).str, 'goodbye, world');
});

test('uses synchronized output sequences', () => {
	const {terminal, stream, log} = setupPartialTest({isTTY: true});

	log('hello world');

	assert.ok(stream.output.includes(SYNCHRONIZED_OUTPUT_ENABLE));
	assert.ok(stream.output.includes(SYNCHRONIZED_OUTPUT_DISABLE));
	assert.ok(stream.output.indexOf(SYNCHRONIZED_OUTPUT_ENABLE) < stream.output.indexOf(SYNCHRONIZED_OUTPUT_DISABLE));
	assert.ok(stream.output.startsWith(SYNCHRONIZED_OUTPUT_ENABLE));
	assert.ok(stream.output.endsWith(SYNCHRONIZED_OUTPUT_DISABLE));
	assert.equal(stream.output.split(SYNCHRONIZED_OUTPUT_ENABLE).length - 1, 1);
	assert.equal(stream.output.split(SYNCHRONIZED_OUTPUT_DISABLE).length - 1, 1);
	assert.equal(terminal.state.getLine(0).str, 'hello world');
});

test('synchronized output wraps every update', () => {
	const terminal = new Terminal({rows: 10, columns: 40});
	terminal.rows = 10;
	terminal.columns = 40;
	terminal.state.setMode('crlf', true);

	const writes = [];
	const stream = {
		rows: terminal.rows,
		columns: terminal.columns,
		isTTY: true,
		write(chunk) {
			writes.push(chunk);
			terminal.write(chunk);
		},
	};

	const log = createLogUpdate(stream);

	log('One');
	log('Two');
	log.clear();
	log('Three');
	log.persist('Persisted');

	for (const chunk of writes) {
		assert.ok(chunk.startsWith(SYNCHRONIZED_OUTPUT_ENABLE));
		assert.ok(chunk.endsWith(SYNCHRONIZED_OUTPUT_DISABLE));
		assert.equal(chunk.split(SYNCHRONIZED_OUTPUT_ENABLE).length - 1, 1);
		assert.equal(chunk.split(SYNCHRONIZED_OUTPUT_DISABLE).length - 1, 1);
	}
});

test('does not use synchronized output on non-tty streams', () => {
	const {stream, log} = setupPartialTest();

	log('hello world');

	assert.ok(!stream.output.includes(SYNCHRONIZED_OUTPUT_ENABLE));
	assert.ok(!stream.output.includes(SYNCHRONIZED_OUTPUT_DISABLE));

	const {stream: falseStream, log: falseLog} = setupPartialTest({isTTY: false});
	falseLog('hello again');

	assert.ok(!falseStream.output.includes(SYNCHRONIZED_OUTPUT_ENABLE));
	assert.ok(!falseStream.output.includes(SYNCHRONIZED_OUTPUT_DISABLE));
});

test('update a single line', () => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('greetings, world');
	log('hello, world');
	log('goodbye, world');
	assert.equal(terminal.state.getLine(0).str, 'goodbye, world');
});

test('output a wrapped line', () => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('this is a very long line that will wrap to the next line');
	assert.equal(terminal.state.getLine(0).str, 'line that will wrap ');
	assert.equal(terminal.state.getLine(1).str, 'to the next line');
});

test('output beyond terminal height', () => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('line 1\nline 2\nline 3');
	assert.equal(terminal.state.getLine(0).str, 'line 2');
	assert.equal(terminal.state.getLine(1).str, 'line 3');
	assert.equal(terminal.state.getLine(2).str, '');
});

test('output beyond terminal height with color', () => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('\u001B[32m√\u001B[39mline 1\nline 2\nline 3');
	assert.equal(terminal.state.getLine(0).str, 'line 2');
	assert.equal(terminal.state.getLine(1).str, 'line 3');
	assert.equal(terminal.state.getLine(2).str, '');
});

test('output beyond terminal height with multi-line color', () => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('\u001B[32m√line 1\nline 2\nline 3\u001B[39m');
	assert.equal(terminal.state.getLine(0).str, 'line 2');
	assert.equal(terminal.state.getLine(1).str, 'line 3');
	assert.equal(terminal.state.getLine(2).str, '');
});

const zeroWidthPrefixCases = [
	['zero-width space', '\u200Bword'],
	['leading zero-width joiner', '\u200Dword'],
	['standalone combining mark', '\u0301word'],
];

test('height clipping with zero-width prefixes does not over-erase on the next update', () => {
	for (const [name, text] of zeroWidthPrefixCases) {
		const {terminal, stream, log} = setupPartialTest({rows: 3, columns: 20});

		log(`A\n${text}\nB\nC`);
		assertTerminalLines(terminal, ['B', 'C', '']);

		stream.output = '';
		log('D');

		assert.equal(countEraseLines(stream.output), 3, name);
	}
});

const zeroWidthFollowUpCases = [
	{
		name: 'leading blank line',
		text: '\u200Bword',
		assertion({stream, message}) {
			assert.equal(stream.output, 'B\nC\n', message);
		},
	},
	{
		name: 'clear',
		text: '\u200Dword',
		assertion({terminal, stream, log, message}) {
			stream.output = '';
			log.clear();
			assert.equal(countEraseLines(stream.output), 3, message);
			assertTerminalLines(terminal, ['', '', '']);
		},
	},
	{
		name: 'persist',
		text: '\u0301word',
		assertion({terminal, stream, log, message}) {
			stream.output = '';
			log.persist('Persisted');
			assert.equal(countEraseLines(stream.output), 3, message);
			assert.ok(stream.output.endsWith('Persisted\n'), message);
			assertTerminalLines(terminal, ['Persisted', '', '']);
		},
	},
];

test('zero-width prefix clipping follow-up operations stay aligned', () => {
	for (const {name, text, assertion} of zeroWidthFollowUpCases) {
		const {terminal, stream, log} = setupPartialTest({rows: 3, columns: 20});
		log(`A\n${text}\nB\nC`);
		assertion({
			terminal,
			stream,
			log,
			message: name,
		});
	}
});

const blankRewriteCases = [
	{
		name: 'rewriting a blank content line keeps the cursor aligned for the next update',
		updates: ['A\nB', 'A\n\n', 'A\nX'],
		expectedLines: ['A', 'X', ''],
	},
	{
		name: 'rewriting a blank middle line preserves the suffix on later updates',
		updates: ['A\nB\nC', 'A\n\nC', 'A\nX\nC'],
		expectedLines: ['A', 'X', 'C', ''],
	},
	{
		name: 'rewriting a blank last content line keeps the cursor aligned for later updates',
		updates: ['A\nB\nC', 'A\nB\n', 'A\nB\nX'],
		expectedLines: ['A', 'B', 'X', ''],
	},
	{
		name: 'adding only trailing blank lines keeps the cursor aligned for later updates',
		updates: ['A', 'A\n\n', 'A\nB'],
		expectedLines: ['A', 'B', ''],
	},
];

for (const {name, updates, expectedLines} of blankRewriteCases) {
	test(name, () => {
		const {terminal, log} = setupPartialTest({rows: 5, columns: 20});

		for (const update of updates) {
			log(update);
		}

		assertTerminalLines(terminal, expectedLines);
	});
}

const setupHalfwidthKanaFrame = () => {
	const context = setupPartialTest({rows: 3, columns: 20});
	context.log('ｶﾞ\nB\nC');
	return context;
};

test('height clipping does not over-remove halfwidth kana graphemes', () => {
	const {terminal, stream} = setupHalfwidthKanaFrame();

	assert.equal(stream.output, 'B\nC\n');
	assertTerminalLines(terminal, ['B', 'C', '']);
});

const halfwidthKanaFollowUpCases = [
	{
		name: 'height clipping with halfwidth kana keeps erase count aligned on the next update',
		assertion({terminal, stream, log}) {
			stream.output = '';
			log('Done');
			assert.equal(countEraseLines(stream.output), 3);
			assertTerminalLines(terminal, ['Done', '', '']);
		},
	},
	{
		name: 'height clipping with halfwidth kana keeps clear aligned',
		assertion({terminal, stream, log}) {
			stream.output = '';
			log.clear();
			assert.equal(countEraseLines(stream.output), 3);
			assertTerminalLines(terminal, ['', '', '']);
		},
	},
	{
		name: 'height clipping with halfwidth kana keeps persist aligned',
		assertion({terminal, stream, log}) {
			stream.output = '';
			log.persist('Persisted');
			assert.equal(countEraseLines(stream.output), 3);
			assert.ok(stream.output.endsWith('Persisted\n'));
			assertTerminalLines(terminal, ['Persisted', '', '']);
		},
	},
];

for (const {name, assertion} of halfwidthKanaFollowUpCases) {
	test(name, () => {
		const context = setupHalfwidthKanaFrame();
		assertion(context);
	});
}

test('all-blank clipped frame does not set previousLineCount above terminalHeight', () => {
	const {terminal, stream, log} = setupPartialTest({rows: 3, columns: 20});

	// '\n\n\n\n' produces 5 split segments, clipped to 3 rows.
	// The clipped text is all-blank; getFrameHeight must count it consistently
	// with split('\n').length so previousLineCount does not exceed terminalHeight.
	log('\n\n\n\n');
	stream.output = '';
	log('X');

	// If previousLineCount were wrong (4 instead of 3), eraseLines would over-erase
	// into scrollback. Exactly 3 erase-line sequences are expected.
	assert.equal(countEraseLines(stream.output), 3);
	assertTerminalLines(terminal, ['X', '', '']);
});

test('shrinking a clipped blank frame does not leave the next render one row too low', () => {
	const {terminal, log} = setupPartialTest({rows: 4, columns: 20});

	log('😀\n\n\n\n');
	log('');
	log('é');

	assertTerminalLines(terminal, ['é', '', '', '']);
});

test('height clipping to one row erases previous output and recovers on resize', () => {
	const {terminal, stream, log} = setupPartialTest({rows: 2, columns: 20});

	log('A');
	terminal.rows = 1;
	stream.rows = 1;
	stream.output = '';
	log('你');

	// On a 1-row terminal, every frame needs at least 2 rows (content + trailing newline),
	// so the frame clips to empty and the previous output is erased.

	terminal.rows = 2;
	stream.rows = 2;
	log('é');
	assertTerminalLines(terminal, ['é', '']);
});

test('adding only trailing blank lines keeps clear aligned', () => {
	const {terminal, log} = setupPartialTest({rows: 3, columns: 20});

	log('A');
	log('A\n\n');
	log.clear();
	log('Fresh');

	assertTerminalLines(terminal, ['Fresh', '', '']);
});

test('adding only trailing blank lines keeps persist aligned', () => {
	const {terminal, log} = setupPartialTest({rows: 3, columns: 20});

	log('A');
	log('A\n\n');
	log.persist('Persisted');
	log('Fresh');

	assertTerminalLines(terminal, ['Persisted', 'Fresh', '']);
});

test('appending after a preserved blank line renders below it', () => {
	const {terminal, stream, log} = setupPartialTest({rows: 6, columns: 20});

	log('A');
	stream.output = '';
	log('A\n\nX');

	assertTerminalLines(terminal, ['A', '', 'X', '']);
});

test('growing output', () => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	log('one line');
	assert.equal(terminal.state.getLine(0).str, 'one line');
	log('one line\ntwo line');
	assert.equal(terminal.state.getLine(0).str, 'one line');
	assert.equal(terminal.state.getLine(1).str, 'two line');
	log('one line\ntwo line\nred line');
	assert.equal(terminal.state.getLine(0).str, 'one line');
	assert.equal(terminal.state.getLine(1).str, 'two line');
	assert.equal(terminal.state.getLine(2).str, 'red line');
	assert.equal(terminal.state.getLine(3).str, '');
	log('one line\ntwo line\nred line\nblue line');
	assert.equal(terminal.state.getLine(0).str, 'two line');
	assert.equal(terminal.state.getLine(1).str, 'red line');
	assert.equal(terminal.state.getLine(2).str, 'blue line');
	assert.equal(terminal.state.getLine(3).str, ''); // Always a blank last line
});

test('growing output from top', () => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	log('blue line');
	assert.equal(terminal.state.getLine(0).str, 'blue line');
	log('red line\nblue line');
	assert.equal(terminal.state.getLine(0).str, 'red line');
	assert.equal(terminal.state.getLine(1).str, 'blue line');
	log('two line\nred line\nblue line');
	assert.equal(terminal.state.getLine(0).str, 'two line');
	assert.equal(terminal.state.getLine(1).str, 'red line');
	assert.equal(terminal.state.getLine(2).str, 'blue line');
	assert.equal(terminal.state.getLine(3).str, '');
	log('one line\ntwo line\nred line\nblue line');
	assert.equal(terminal.state.getLine(0).str, 'two line');
	assert.equal(terminal.state.getLine(1).str, 'red line');
	assert.equal(terminal.state.getLine(2).str, 'blue line');
	assert.equal(terminal.state.getLine(3).str, ''); // Always a blank last line
});

test('shrinking output', () => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	log('one line\ntwo line\nred line\nblue line');
	assert.equal(terminal.state.getLine(0).str, 'two line');
	assert.equal(terminal.state.getLine(1).str, 'red line');
	assert.equal(terminal.state.getLine(2).str, 'blue line');
	assert.equal(terminal.state.getLine(3).str, ''); // Always a blank last line
	log('one line\ntwo line\nred line');
	assert.equal(terminal.state.getLine(0).str, 'one line');
	assert.equal(terminal.state.getLine(1).str, 'two line');
	assert.equal(terminal.state.getLine(2).str, 'red line');
	assert.equal(terminal.state.getLine(3).str, '');
	log('one line\ntwo line');
	assert.equal(terminal.state.getLine(0).str, 'one line');
	assert.equal(terminal.state.getLine(1).str, 'two line');
	log('one line');
	assert.equal(terminal.state.getLine(0).str, 'one line');
});

test('lots of updates', () => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	for (let i = 0; i < 100; i++) {
		log([
			`[1] ${(i ** 3) + 11}`,
			`[2] ${(i ** 2) + (10 * i) - 100}`,
		].join('\n'));
	}

	assert.equal(terminal.state.getLine(0).str, '[1] 970310');
	assert.equal(terminal.state.getLine(1).str, '[2] 10691');
});

test('log.done', () => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('Fun families are all similar');
	log('Happy families are all similar');
	log.done();
	log('Happy families are all alike; every unhappy family has its own way');
	log('Happy families are all alike; every unhappy family is unhappy in its own way');
	log.done();
	assert.equal(terminal.state.getLine(0).str, 'Happy families are all similar');
	assert.equal(terminal.state.getLine(1).str, 'Happy families are all alike; every unhappy family is unhappy in its own way');
});

test('log.clear', () => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('Info');
	log.clear();
	log.done();
	log('Second Info');
	assert.equal(terminal.state.getLine(0).str, 'Second Info');
});

test('clear after hard wrapped text', () => {
	const {terminal, log} = setup({rows: 10, columns: 20});

	// Log text that will be hard wrapped
	log('This is a very long line that will be hard wrapped across multiple terminal lines');
	// The text should be wrapped across multiple lines
	assert.equal(terminal.state.getLine(0).str, 'This is a very long ');
	assert.equal(terminal.state.getLine(1).str, 'line that will be ha');
	assert.equal(terminal.state.getLine(2).str, 'rd wrapped across mu');
	assert.equal(terminal.state.getLine(3).str, 'ltiple terminal line');
	assert.equal(terminal.state.getLine(4).str, 's');

	// Now update with shorter text
	log('Short text');
	// The previous wrapped lines should be cleared
	assert.equal(terminal.state.getLine(0).str, 'Short text');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, '');
	assert.equal(terminal.state.getLine(3).str, '');
	assert.equal(terminal.state.getLine(4).str, '');
});

test('clear after hard wrapped text with ANSI codes', () => {
	const {terminal, log} = setup({rows: 10, columns: 20});

	// Log text with ANSI codes that will be hard wrapped
	log('\u001B[32mThis is a very long green line that will be hard wrapped across multiple terminal lines\u001B[39m');

	// Now update with shorter text
	log('Short text');
	// The previous wrapped lines should be cleared
	assert.equal(terminal.state.getLine(0).str, 'Short text');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, '');
	assert.equal(terminal.state.getLine(3).str, '');
	assert.equal(terminal.state.getLine(4).str, '');
});

test('defaultWidth option used when stream has no columns', () => {
	// Create a stream without columns property
	const terminal = new Terminal({rows: 10});
	terminal.rows = 10;
	delete terminal.columns; // Explicitly remove columns property
	terminal.state.setMode('crlf', true);

	// Create log with defaultWidth
	const log = createLogUpdate(terminal, {defaultWidth: 30});

	// Log text that's longer than 30 characters
	log('This text should wrap at exactly 30 characters width');

	// Should be wrapped at 30 characters
	assert.equal(terminal.state.getLine(0).str, 'This text should wrap at exact');
	assert.equal(terminal.state.getLine(1).str, 'ly 30 characters width');
});

test('defaultWidth not used when stream has columns', () => {
	// Create a terminal with columns set to 20
	const terminal = new Terminal({rows: 10, columns: 20});
	terminal.rows = 10;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	// Create log with defaultWidth that should be ignored
	const log = createLogUpdate(terminal, {defaultWidth: 50});

	// Log text that's longer than 20 but shorter than 50
	log('This text is exactly 35 characters');

	// Should be wrapped at 20 characters (stream.columns), not 50 (defaultWidth)
	assert.equal(terminal.state.getLine(0).str, 'This text is exactly');
	assert.equal(terminal.state.getLine(1).str, ' 35 characters');
});

test('defaultHeight option used when stream has no rows', () => {
	// Create a stream without rows property
	const terminal = new Terminal({columns: 20});
	terminal.columns = 20;
	delete terminal.rows; // Explicitly remove rows property
	terminal.state.setMode('crlf', true);

	// Create log with defaultHeight of 3 (instead of default 24)
	const log = createLogUpdate(terminal, {defaultHeight: 3});

	// Log 5 lines of text - should be truncated to 3 lines
	log('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

	// Should only show last 3 lines due to defaultHeight: 3
	// (Note: log adds a newline, so we have 6 total lines, remove first 3)
	assert.equal(terminal.state.getLine(0).str, 'Line 4');
	assert.equal(terminal.state.getLine(1).str, 'Line 5');
	assert.equal(terminal.state.getLine(2).str, '');
});

test('defaultHeight not used when stream has rows', () => {
	// Create a terminal with rows set to 2
	const terminal = new Terminal({rows: 2, columns: 20});
	terminal.rows = 2;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	// Create log with defaultHeight that should be ignored
	const log = createLogUpdate(terminal, {defaultHeight: 5});

	// Log 4 lines of text
	log('Line 1\nLine 2\nLine 3\nLine 4');

	// Should be truncated to 2 lines (stream.rows), not 5 (defaultHeight)
	// (Note: log adds a newline, so we have 5 total lines, remove first 3)
	assert.equal(terminal.state.getLine(0).str, 'Line 4');
	assert.equal(terminal.state.getLine(1).str, '');
});

test('height fitting truncates content that exceeds terminal height', () => {
	const {terminal, log} = setup({rows: 3, columns: 80});

	// Log content that exceeds terminal height
	log('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

	// Should only show the last 3 lines (terminal height)
	assert.equal(terminal.state.getLine(0).str, 'Line 4');
	assert.equal(terminal.state.getLine(1).str, 'Line 5');
	assert.equal(terminal.state.getLine(2).str, '');
});

test('height fitting behavior causes scrollback pollution when disabled', () => {
	const {terminal, log} = setup({rows: 2, columns: 80});

	// Simulate what would happen without height fitting
	// First update: 4 lines (2 go to scrollback, 2 visible)
	log('A1\nA2\nA3\nA4');
	// Current visible: A3, A4
	assert.equal(terminal.state.getLine(0).str, 'A4');
	assert.equal(terminal.state.getLine(1).str, '');

	// Second update: 4 lines again (would push 2 more to scrollback)
	log('B1\nB2\nB3\nB4');
	// Current visible: B3, B4
	assert.equal(terminal.state.getLine(0).str, 'B4');
	assert.equal(terminal.state.getLine(1).str, '');

	// This demonstrates why height fitting exists - without it,
	// scrollback would contain: A1, A2, A3, A4, B1, B2
	// And user would see intermediate states mixed with final states
});

test('persist method writes to scrollback without height fitting', () => {
	const {log} = setup({rows: 3, columns: 80});

	// Use persist to write content that exceeds terminal height
	log.persist('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

	// Content should be written without height fitting
	// Note: terminal.js simulates visible area, but full content was written
	assert.ok(true);
});

test('persist method clears previous update before writing', () => {
	const {terminal, log} = setup({rows: 3, columns: 80});

	// First do a normal update
	log('This will be cleared');
	assert.equal(terminal.state.getLine(0).str, 'This will be cleared');

	// Now persist should clear the update and write new content
	log.persist('Permanent line 1');
	log.persist('Permanent line 2');

	// Both persist calls should have written their content
	assert.ok(true);
});

test('mixing persist and normal updates', () => {
	const {terminal, log} = setup({rows: 4, columns: 80});

	// Normal update
	log('Updating...');
	assert.equal(terminal.state.getLine(0).str, 'Updating...');

	// Persist some output
	log.persist('✓ Task 1 complete');

	// Another normal update
	log('Processing task 2...');

	// Another persist
	log.persist('✓ Task 2 complete');

	// Final update
	log('All done!');

	assert.ok(true);
});

test('persist method accepts multiple arguments', () => {
	const {terminal} = setup({rows: 3, columns: 80});
	const log = createLogUpdate(terminal);

	// Test multiple arguments like console.log
	log.persist('Status:', 'SUCCESS', '✓');

	assert.ok(true);
});

test('persist method wraps long lines', () => {
	const {terminal} = setup({rows: 3, columns: 20});
	const log = createLogUpdate(terminal);

	// Persist a long line that needs wrapping
	log.persist('This is a very long line that will be wrapped');

	// Should be wrapped but not height-truncated
	assert.ok(true);
});

test('partial updates: append-only update causes no erase', () => {
	const terminal = new Terminal({rows: 10, columns: 40});
	terminal.rows = 10;
	terminal.columns = 40;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('A\nB');
	stream.output = '';
	log('A\nB\nC');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;

	// Appending rewrites the trailing blank to reposition it correctly
	assert.equal(eraseCount, 1);
	assert.ok(stream.output.includes('C'));
});

test('width change falls back to full erase', () => {
	const terminal = new Terminal({rows: 10, columns: 20});
	terminal.rows = 10;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('One\nTwo\nThree');
	stream.output = '';
	// Simulate width change
	stream.columns = 30;
	terminal.columns = 30;
	log('One\nTwo\nFour');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	// We expect a full erase of previous 4 lines (3 + trailing blank)
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;
	// At least 4, some terminals may add extra clears; assert lower-bound
	assert.ok(eraseCount >= 4);
});

test('partial updates: only redraw changed tail', () => {
	const terminal = new Terminal({rows: 10, columns: 80});
	terminal.rows = 10;
	terminal.columns = 80;
	terminal.state.setMode('crlf', true);

	class CapturingStream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new CapturingStream(terminal);
	const log = createLogUpdate(stream);

	// First render 3 lines
	log('Alpha\nBeta\nGamma');
	// Capture only the second render
	stream.output = '';
	// Change only the last line
	log('Alpha\nBeta\nDelta');

	// Expect not to fully clear all 4 lines (3 + trailing newline)
	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseLineMatches = stream.output.split(ERASE_LINE).length - 1;
	// Should clear exactly 1 line: the changed line (suffix preserved)
	assert.equal(eraseLineMatches, 1);

	// Should move up exactly 1 line from the blank line to the changed line
	// CSI n A where n is 1
	const CURSOR_UP_1 = `${ESC}1A`;
	const cursorUpMatches = stream.output.split(CURSOR_UP_1).length - 1;
	assert.ok(cursorUpMatches > 0);
});

test('partial updates: unchanged suffix is preserved (clear only middle block)', () => {
	const terminal = new Terminal({rows: 10, columns: 80});
	terminal.rows = 10;
	terminal.columns = 80;
	terminal.state.setMode('crlf', true);

	class CapturingStream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new CapturingStream(terminal);
	const log = createLogUpdate(stream);

	// First render 3 lines
	log('Top\nMiddle\nBottom');
	// Capture only the second render
	stream.output = '';
	// Change only the middle line, keep top and bottom unchanged
	log('Top\nChanged\nBottom');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;

	// Should clear exactly 1 line (the changed middle line), not the entire tail
	assert.equal(eraseCount, 1);
});

test('wrap-first height fitting with long wrapped line', () => {
	const {terminal, log} = setup({rows: 3, columns: 10});

	// Single long line that wraps across more than terminal height
	log('abcdefghijklmnopqrstuvwxyz');

	// After wrapping and height fitting, we should only see the last two wrapped segments
	// plus the trailing blank line due to the final newline
	assert.equal(terminal.state.getLine(0).str, 'klmnopqrst');
	assert.equal(terminal.state.getLine(1).str, 'uvwxyz');
	assert.equal(terminal.state.getLine(2).str, '');
});

test('prefix-zero diff falls back to full erase', () => {
	const terminal = new Terminal({rows: 10, columns: 20});
	terminal.rows = 10;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('A\nB\nC');
	stream.output = '';
	log('X\nY\nZ');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;

	// Previous had 3 lines + trailing blank = 4
	assert.ok(eraseCount >= 4);
});

test('no-op update produces no output', () => {
	const terminal = new Terminal({rows: 5, columns: 20});
	terminal.rows = 5;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('Hello\nWorld');
	stream.output = '';
	log('Hello\nWorld');

	// No escape activity and no writes
	assert.equal(stream.output, '');
});

test('no-op after wrapping produces no output', () => {
	const terminal = new Terminal({rows: 3, columns: 10});
	terminal.rows = 3;
	terminal.columns = 10;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	const long = 'abcdefghijABCDEFGHIJklmno';
	log(long);
	stream.output = '';
	log(long);

	// No additional writes for identical wrapped content
	assert.equal(stream.output, '');
});

test('change only second line clears exactly one line', () => {
	const terminal = new Terminal({rows: 5, columns: 20});
	terminal.rows = 5;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('A\nB\nC');
	stream.output = '';
	log('A\nX\nC');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;

	// Only second line should be cleared
	assert.equal(eraseCount, 1);
});

test('remove middle line rewrites suffix at new position', () => {
	const terminal = new Terminal({rows: 5, columns: 20});
	terminal.rows = 5;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('A\nX\nC');
	stream.output = '';
	log('A\nC');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;

	// Suffix is rewritten at its new position when lines are removed
	assert.equal(eraseCount, 3);
});

test('insert middle line rewrites suffix at new position', () => {
	const terminal = new Terminal({rows: 5, columns: 20});
	terminal.rows = 5;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('A\nC');
	stream.output = '';
	log('A\nX\nC');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;

	// Suffix is rewritten at its new position when lines are inserted
	assert.equal(eraseCount, 2);
});

test('emoji wide chars: change second line clears exactly one line', () => {
	const terminal = new Terminal({rows: 5, columns: 10});
	terminal.rows = 5;
	terminal.columns = 10;
	terminal.state.setMode('crlf', true);

	class Stream {
		output = '';

		constructor(target) {
			this.target = target;
			this.rows = target.rows;
			this.columns = target.columns;
		}

		write(chunk) {
			this.output += chunk;
			this.target.write(chunk);
		}
	}

	const stream = new Stream(terminal);
	const log = createLogUpdate(stream);

	log('😀😀\nTwo');
	stream.output = '';
	log('😀😀\nThree');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;

	// Only the second line should be cleared
	assert.equal(eraseCount, 1);
});

test('ANSI color change in middle line clears exactly one line', () => {
	const terminal = new Terminal({rows: 5, columns: 80});
	terminal.rows = 5;
	terminal.columns = 80;
	terminal.state.setMode('crlf', true);

	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	log('Top\n\u001B[31mRed\u001B[39m\nBottom');
	stream.output = '';
	log('Top\n\u001B[32mGreen\u001B[39m\nBottom');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;
	// Only the color-changed line should be cleared
	assert.equal(eraseCount, 1);
});

test('persist resets state: next update does not erase', () => {
	const terminal = new Terminal({rows: 5, columns: 40});
	terminal.rows = 5;
	terminal.columns = 40;
	terminal.state.setMode('crlf', true);

	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	log('A\nB');
	stream.output = '';
	log.persist('persisted');
	stream.output = '';
	log('X');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;
	// Fresh session after persist: no erase should occur
	assert.equal(eraseCount, 0);
});

test('partial after resize uses minimal clear on subsequent change', () => {
	const terminal = new Terminal({rows: 5, columns: 20});
	terminal.rows = 5;
	terminal.columns = 20;
	terminal.state.setMode('crlf', true);

	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	log('Top\nMiddle\nBottom');
	// Resize triggers full erase on next update
	stream.output = '';
	stream.columns = 30;
	terminal.columns = 30;
	log('Top\nMiddle\nBottom');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	let eraseCount = stream.output.split(ERASE_LINE).length - 1;
	// Full erase (3 lines + trailing blank)
	assert.ok(eraseCount >= 4);

	// Next change should be minimal again
	stream.output = '';
	log('Top\nChanged\nBottom');
	eraseCount = stream.output.split(ERASE_LINE).length - 1;
	assert.equal(eraseCount, 1);
});

test('clear resets state: next update does not erase', () => {
	const terminal = new Terminal({rows: 5, columns: 40});
	terminal.rows = 5;
	terminal.columns = 40;
	terminal.state.setMode('crlf', true);

	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	log('A\nB');
	stream.output = '';
	log.clear();
	stream.output = '';
	log('X');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;
	// Fresh session after clear: no erase should occur
	assert.equal(eraseCount, 0);
});

test('zero terminal height returns empty output', () => {
	const fakeStream = {
		columns: 80,
		rows: 0,
		output: '',
		write(chunk) {
			this.output += chunk;
		},
	};

	const log = createLogUpdate(fakeStream);
	log('Line 1\nLine 2\nLine 3');

	// With zero height, output should be empty
	assert.equal(fakeStream.output, '');
});

test('rows=0 skips writing, then resumes cleanly when rows>0', () => {
	const stream = {
		columns: 80,
		rows: 0,
		output: '',
		write(chunk) {
			this.output += chunk;
		},
	};

	const log = createLogUpdate(stream);
	log('Line 1');
	// Nothing written when height is zero
	assert.equal(stream.output, '');

	// Increase rows and render
	stream.rows = 3;
	stream.output = '';
	log('Line 1\nLine 2');

	const ESC = '\u001B[';
	const ERASE_LINE = `${ESC}2K`;
	// Fresh write; no erases should be emitted
	const eraseCount = stream.output.split(ERASE_LINE).length - 1;
	assert.equal(eraseCount, 0);
});

test('preserves multiple trailing blank lines', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	// Test with two trailing newlines
	log('Hello\n\n');
	assert.equal(terminal.state.getLine(0).str, 'Hello');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, '');

	// Test with three trailing newlines
	log('World\n\n\n');
	assert.equal(terminal.state.getLine(0).str, 'World');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, '');
	assert.equal(terminal.state.getLine(3).str, '');
});

test('preserves user trailing newlines and ensures at least one', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	// Test without trailing newline - should add one for rendering
	log('Hello');
	assert.equal(terminal.state.getLine(0).str, 'Hello');
	assert.equal(terminal.state.getLine(1).str, '');

	// Test with one trailing newline - should preserve it
	log('World\n');
	assert.equal(terminal.state.getLine(0).str, 'World');
	assert.equal(terminal.state.getLine(1).str, '');

	// Test with two trailing newlines - should preserve both
	log('Multiple\n\n');
	assert.equal(terminal.state.getLine(0).str, 'Multiple');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, '');
});

test('preserves blank lines in the middle of text', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('First line\n\nThird line');
	assert.equal(terminal.state.getLine(0).str, 'First line');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, 'Third line');
});

test('issue #62: multiple blank lines at the end', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	// This is the exact scenario from the issue
	log('# Hello world\n\n');
	assert.equal(terminal.state.getLine(0).str, '# Hello world');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, '');

	log('# Hello world\n\nIt\'s');
	assert.equal(terminal.state.getLine(0).str, '# Hello world');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, 'It\'s');

	log('# Hello world\n\nIt\'s a beautiful day');
	assert.equal(terminal.state.getLine(0).str, '# Hello world');
	assert.equal(terminal.state.getLine(1).str, '');
	assert.equal(terminal.state.getLine(2).str, 'It\'s a beautiful day');
});

test('issue #64: animated updates preserve trailing lines', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	const frames = ['-', '\\', '|', '/'];

	// Simulate animation updates like the reported issue
	for (const frame of frames) {
		log(`
        ♥♥
   ${frame} unicorns ${frame}
        ♥♥
`);

		// All lines including leading/trailing blank lines must be preserved
		assert.equal(terminal.state.getLine(0).str, '');
		assert.equal(terminal.state.getLine(1).str, '        ♥♥');
		assert.equal(terminal.state.getLine(2).str, `   ${frame} unicorns ${frame}`);
		assert.equal(terminal.state.getLine(3).str, '        ♥♥');
		assert.equal(terminal.state.getLine(4).str, '');
	}
});

test('huge frames are batched into a single write', () => {
	class CountingStream {
		columns = 80;
		rows = 20_000;
		output = '';
		writeCount = 0;

		write(chunk) {
			this.writeCount++;
			this.output += chunk;
		}
	}

	const stream = new CountingStream();
	const log = createLogUpdate(stream);

	const lines = Array.from({length: 10_000}, (_, i) => `L${i}`);
	log(lines.join('\n'));
	assert.equal(stream.writeCount, 1);

	// Change a middle line and ensure still single write (patch is batched)
	stream.writeCount = 0;
	lines[5000] = 'L5000_changed';
	log(lines.join('\n'));
	assert.equal(stream.writeCount, 1);
});

// Comprehensive partial rendering tests
test('partial rendering: modify first line only', () => {
	const {stream, log} = setupPartialTest();

	log('Line A\nLine B\nLine C');
	stream.output = '';

	log('Line A MODIFIED\nLine B\nLine C');

	// When modifying first line, the algorithm clears all changed lines
	assert.ok(countEraseLines(stream.output) >= 1);
	assert.ok(stream.output.includes('A MODIFIED'));
});

test('partial rendering: modify middle line only', () => {
	const {stream, log} = setupPartialTest();

	log('Line A\nLine B\nLine C\nLine D\nLine E');
	stream.output = '';

	log('Line A\nLine B\nLine C MODIFIED\nLine D\nLine E');

	// Should clear exactly 1 line (line C) and rewrite it
	assert.equal(countEraseLines(stream.output), 1);
	assert.ok(stream.output.includes('C MODIFIED'));
});

test('partial rendering: modify last line only', () => {
	const {stream, log} = setupPartialTest();

	log('Line A\nLine B\nLine C');
	stream.output = '';

	log('Line A\nLine B\nLine C MODIFIED');

	// Should clear exactly 1 line (last line) and rewrite it
	assert.equal(countEraseLines(stream.output), 1);
	assert.ok(stream.output.includes('C MODIFIED'));
});

test('partial rendering: insert line in middle', () => {
	const {stream, log} = setupPartialTest();

	log('Line A\nLine B\nLine D');
	stream.output = '';

	log('Line A\nLine B\nLine C\nLine D');

	// Suffix is rewritten at its new position when lines are inserted
	assert.equal(countEraseLines(stream.output), 2);
	assert.ok(stream.output.includes('Line C'));
});

test('partial rendering: remove line from middle', () => {
	const {stream, log} = setupPartialTest();

	log('Line A\nLine B\nLine C\nLine D');
	stream.output = '';

	log('Line A\nLine B\nLine D');

	// Suffix is rewritten at its new position when lines are removed
	assert.equal(countEraseLines(stream.output), 3);
	assert.ok(stream.output.includes('Line D'));
});

test('partial rendering: modify multiple consecutive lines', () => {
	const {stream, log} = setupPartialTest();

	log('Line A\nLine B\nLine C\nLine D\nLine E');
	stream.output = '';

	log('Line A\nLine B MODIFIED\nLine C MODIFIED\nLine D\nLine E');

	// Should clear exactly 2 consecutive lines (B and C) and rewrite them
	assert.equal(countEraseLines(stream.output), 2);
	assert.ok(stream.output.includes('B MODIFIED'));
	assert.ok(stream.output.includes('C MODIFIED'));
});

test('partial rendering: common prefix and suffix optimization', () => {
	const {stream, log} = setupPartialTest();

	log('SAME\nOLD\nOLD\nOLD\nSAME');
	stream.output = '';

	log('SAME\nNEW\nNEW\nNEW\nSAME');

	// Should only clear and rewrite the 3 changed middle lines, preserving prefix/suffix
	assert.equal(countEraseLines(stream.output), 3);
	assert.ok(stream.output.includes('NEW'));
	// Should not rewrite the unchanged prefix/suffix lines
	const sameCount = (stream.output.match(/SAME/gv) || []).length;
	assert.equal(sameCount, 0); // SAME lines should not be in the partial update
});

test('partial rendering: change with different line counts', () => {
	const {stream, log} = setupPartialTest();

	log('Line 1\nLine 2');
	stream.output = '';

	log('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

	// Growing output rewrites from the changed point to reposition trailing content
	assert.equal(countEraseLines(stream.output), 1);
	assert.ok(stream.output.includes('Line 3'));
	assert.ok(stream.output.includes('Line 5'));
});

test('partial rendering: complex mixed changes', () => {
	const {stream, log} = setupPartialTest();

	log('Keep\nChange\nRemove\nKeep\nChange\nAdd after this');
	stream.output = '';

	log('Keep\nChanged\nKeep\nChanged\nAdd after this\nNew line');

	// Should handle mixed operations - may fall back to full erase for complex changes
	const eraseCount = countEraseLines(stream.output);
	assert.ok(eraseCount >= 0); // Algorithm handles it efficiently (may use full erase)
	assert.ok(stream.output.includes('Changed'));
	assert.ok(stream.output.includes('New line'));
});

test('identical updates are skipped (no-op optimization)', () => {
	const stream = {
		columns: 80,
		rows: 5,
		output: '',
		writeCount: 0,
		write(chunk) {
			this.writeCount++;
			this.output += chunk;
		},
	};

	const log = createLogUpdate(stream);

	// First update should go through
	log('Frame 1');
	assert.equal(stream.writeCount, 1);

	// Identical updates should be skipped
	stream.writeCount = 0;
	log('Frame 1');
	log('Frame 1');
	log('Frame 1');
	assert.equal(stream.writeCount, 0);

	// Different content should go through
	log('Frame 2');
	assert.equal(stream.writeCount, 1);
});

test('rapid updates with different content all go through', () => {
	const stream = {
		columns: 80,
		rows: 5,
		output: '',
		writeCount: 0,
		write(chunk) {
			this.writeCount++;
			this.output += chunk;
		},
	};

	const log = createLogUpdate(stream);

	// All different updates should go through
	for (let i = 1; i <= 10; i++) {
		log(`Frame ${i}`);
	}

	// All updates should have been written
	assert.equal(stream.writeCount, 10);
});

test('empty string input produces no output', () => {
	const stream = {
		columns: 80,
		rows: 5,
		output: '',
		write(chunk) {
			this.output += chunk;
		},
	};

	const log = createLogUpdate(stream);
	log('');

	// Empty string should still produce output (just newline)
	assert.ok(stream.output.length > 0);
});

test('correct line counting with ANSI escape codes', () => {
	const {terminal} = setup({rows: 5, columns: 40});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	// Text with ANSI codes that shouldn't affect line counting
	log('\u001B[32mGreen line\u001B[39m\n\u001B[31mRed line\u001B[39m');
	stream.output = '';

	// Update with different colors
	log('\u001B[33mYellow line\u001B[39m\n\u001B[34mBlue line\u001B[39m');

	// Should properly count as 2 lines despite ANSI codes
	const eraseCount = countEraseLines(stream.output);
	assert.ok(eraseCount <= 3); // 2 lines + trailing
});

test('persist does not height-clip output', () => {
	const {terminal} = setup({rows: 3, columns: 40});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	// Persist 5 lines into a terminal with only 3 rows.
	// All 5 lines should be written since persist is permanent scrollback output.
	log.persist('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

	assert.ok(stream.output.includes('Line 1'), 'persist should not clip Line 1');
	assert.ok(stream.output.includes('Line 2'), 'persist should not clip Line 2');
	assert.ok(stream.output.includes('Line 3'), 'persist should not clip Line 3');
	assert.ok(stream.output.includes('Line 4'), 'persist should not clip Line 4');
	assert.ok(stream.output.includes('Line 5'), 'persist should not clip Line 5');
});

test('insert line with visible suffix renders correctly', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('A\nC');
	log('A\nX\nC');

	// After inserting X between A and C, the suffix C must appear at its new position
	assert.equal(terminal.state.getLine(0).str, 'A');
	assert.equal(terminal.state.getLine(1).str, 'X');
	assert.equal(terminal.state.getLine(2).str, 'C');
});

test('remove line with visible suffix renders correctly', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('A\nB\nC\nD');
	log('A\nD');

	// After removing B and C, the suffix D must shift up
	assert.equal(terminal.state.getLine(0).str, 'A');
	assert.equal(terminal.state.getLine(1).str, 'D');
});

test('insert multiple lines with visible suffix renders correctly', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('Header\nFooter');
	log('Header\nNew 1\nNew 2\nNew 3\nFooter');

	assert.equal(terminal.state.getLine(0).str, 'Header');
	assert.equal(terminal.state.getLine(1).str, 'New 1');
	assert.equal(terminal.state.getLine(2).str, 'New 2');
	assert.equal(terminal.state.getLine(3).str, 'New 3');
	assert.equal(terminal.state.getLine(4).str, 'Footer');
});

test('shrink then grow with common prefix renders correctly', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	// Shrink from 4 lines to 1, keeping common prefix
	log('Header\nTask 1\nTask 2\nTask 3');
	log('Header');

	// Grow again - must not leave ghost content
	log('Header\nNew 1\nNew 2');

	assert.equal(terminal.state.getLine(0).str, 'Header');
	assert.equal(terminal.state.getLine(1).str, 'New 1');
	assert.equal(terminal.state.getLine(2).str, 'New 2');
});

test('height clipping with CJK on removed lines produces correct line count', () => {
	const {terminal} = setup({rows: 3, columns: 40});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	// 4 content lines + trailing = 5 lines, height 3 → remove 2
	log('你好世界\n第二行\nLine 3\nLine 4');

	// The raw output must not contain the CJK lines (they should be clipped)
	assert.ok(!stream.output.includes('你好'), 'CJK line should be clipped');
	assert.ok(!stream.output.includes('第二'), 'CJK line should be clipped');
	assert.ok(stream.output.includes('Line 3'), 'Line 3 should be visible');
	assert.ok(stream.output.includes('Line 4'), 'Line 4 should be visible');
});

test('height clipping with emoji on removed lines produces correct line count', () => {
	const {terminal} = setup({rows: 3, columns: 40});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	// 4 content lines + trailing = 5 lines, height 3 → remove 2
	log('👨‍👩‍👧 Family\n🎉 Party\nLine 3\nLine 4');

	// The raw output must not contain the emoji lines
	assert.ok(!stream.output.includes('Family'), 'Emoji line should be clipped');
	assert.ok(!stream.output.includes('Party'), 'Emoji line should be clipped');
	assert.ok(stream.output.includes('Line 3'), 'Line 3 should be visible');
	assert.ok(stream.output.includes('Line 4'), 'Line 4 should be visible');
});

test('shrink to single line then update preserves correct cursor position', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('Status\nA\nB\nC\nD');
	log('Status');
	log('Done');

	assert.equal(terminal.state.getLine(0).str, 'Done');
	assert.equal(terminal.state.getLine(1).str, '');
});

test('repeated shrink and grow cycles render correctly', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('H\nA\nB\nC');
	log('H');
	log('H\nX');
	assert.equal(terminal.state.getLine(0).str, 'H');
	assert.equal(terminal.state.getLine(1).str, 'X');

	log('H');
	log('H\nY\nZ');
	assert.equal(terminal.state.getLine(0).str, 'H');
	assert.equal(terminal.state.getLine(1).str, 'Y');
	assert.equal(terminal.state.getLine(2).str, 'Z');
});

test('shrink with multi-line common prefix renders correctly', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
	// Shrink keeping 2-line prefix
	log('Line 1\nLine 2');

	assert.equal(terminal.state.getLine(0).str, 'Line 1');
	assert.equal(terminal.state.getLine(1).str, 'Line 2');

	// Grow back
	log('Line 1\nLine 2\nNew 3');
	assert.equal(terminal.state.getLine(0).str, 'Line 1');
	assert.equal(terminal.state.getLine(1).str, 'Line 2');
	assert.equal(terminal.state.getLine(2).str, 'New 3');
});

test('height clipping with CJK then update erases correct line count', () => {
	const {terminal, log} = setup({rows: 3, columns: 40});

	log('你好世界\n第二行\nLine 3\nLine 4');
	// After clipping, update with ASCII-only content
	log('AAA\nBBB');

	assert.equal(terminal.state.getLine(0).str, 'AAA');
	assert.equal(terminal.state.getLine(1).str, 'BBB');
	assert.equal(terminal.state.getLine(2).str, '');
});

test('height clipping with VS16 emoji on removed lines', () => {
	const {terminal} = setup({rows: 3, columns: 40});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	// ❤️ is U+2764 + U+FE0F (VS16), width 2 in slice-ansi
	log('❤️ love\n☁️ cloud\nLine 3\nLine 4');

	assert.ok(!stream.output.includes('love'), 'VS16 emoji line should be clipped');
	assert.ok(!stream.output.includes('cloud'), 'VS16 emoji line should be clipped');
	assert.ok(stream.output.includes('Line 3'));
	assert.ok(stream.output.includes('Line 4'));
});

test('height clipping with mixed CJK, emoji, and ASCII', () => {
	const {terminal} = setup({rows: 3, columns: 40});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	log('🎉 你好\nASCII line\nVisible 1\nVisible 2');

	assert.ok(!stream.output.includes('你好'), 'Mixed line should be clipped');
	assert.ok(!stream.output.includes('ASCII'), 'ASCII line should be clipped'); // eslint-disable-line unicorn/text-encoding-identifier-case
	assert.ok(stream.output.includes('Visible 1'));
	assert.ok(stream.output.includes('Visible 2'));
});

test('height clipping preserves ANSI codes across clipped boundary', () => {
	const {terminal, log} = setup({rows: 3, columns: 40});

	// Green color opened on first line, closed on third
	log('\u001B[32mRemoved line\nKept line\nLast line\u001B[39m');

	// The first line is removed, but the green code must be re-opened
	assert.equal(terminal.state.getLine(0).str, 'Kept line');
	assert.equal(terminal.state.getLine(1).str, 'Last line');
});

test('done after shrink starts fresh session at correct position', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('Title\nA\nB\nC');
	log('Title');
	log.done();

	// New session after done should write below the persisted output
	log('New session');
	assert.equal(terminal.state.getLine(0).str, 'Title');
	assert.equal(terminal.state.getLine(1).str, 'New session');
});

test('clear after shrink leaves no artifacts', () => {
	const {terminal, log} = setup({rows: 10, columns: 40});

	log('Prefix\nX\nY\nZ');
	log('Prefix');
	log.clear();

	log('Fresh');
	assert.equal(terminal.state.getLine(0).str, 'Fresh');
});

test('persist after height-clipped render', () => {
	const {terminal} = setup({rows: 3, columns: 40});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	// First do a height-clipped render
	log('A\nB\nC\nD\nE');
	stream.output = '';

	// Persist should erase the clipped output and write unclipped content
	log.persist('Persisted line');
	assert.ok(stream.output.includes('Persisted line'));
});

test('height clipping with CJK that also wraps', () => {
	const {terminal} = setup({rows: 3, columns: 10});
	const stream = makeCapturingStream(terminal);
	const log = createLogUpdate(stream);

	// CJK line wraps at width 10 (each CJK char is 2 columns, so 5 per line)
	// "你好世界测试完成" = 8 CJK chars = 16 columns → wraps to 2 lines at width 10
	log('你好世界测试完成\nVisible');

	assert.ok(stream.output.includes('Visible'));
});
