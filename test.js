import test from 'ava';
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

test('output a single line', t => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('goodbye, world');
	t.is(terminal.state.getLine(0).str, 'goodbye, world');
});

test('update a single line', t => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('greetings, world');
	log('hello, world');
	log('goodbye, world');
	t.is(terminal.state.getLine(0).str, 'goodbye, world');
});

test('output a wrapped line', t => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('this is a very long line that will wrap to the next line');
	t.is(terminal.state.getLine(0).str, 'line that will wrap ');
	t.is(terminal.state.getLine(1).str, 'to the next line');
});

test('output beyond terminal height', t => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('line 1\nline 2\nline 3');
	t.is(terminal.state.getLine(0).str, 'line 2');
	t.is(terminal.state.getLine(1).str, 'line 3');
	t.is(terminal.state.getLine(2).str, '');
});

test('output beyond terminal height with color', t => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('\u001B[32m√\u001B[39mline 1\nline 2\nline 3');
	t.is(terminal.state.getLine(0).str, 'line 2');
	t.is(terminal.state.getLine(1).str, 'line 3');
	t.is(terminal.state.getLine(2).str, '');
});

test('output beyond terminal height with multi-line color', t => {
	const {terminal, log} = setup({rows: 3, columns: 20});

	log('\u001B[32m√line 1\nline 2\nline 3\u001B[39m');
	t.is(terminal.state.getLine(0).str, 'line 2');
	t.is(terminal.state.getLine(1).str, 'line 3');
	t.is(terminal.state.getLine(2).str, '');
});

test('growing output', t => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	log('one line');
	t.is(terminal.state.getLine(0).str, 'one line');
	log('one line\ntwo line');
	t.is(terminal.state.getLine(0).str, 'one line');
	t.is(terminal.state.getLine(1).str, 'two line');
	log('one line\ntwo line\nred line');
	t.is(terminal.state.getLine(0).str, 'one line');
	t.is(terminal.state.getLine(1).str, 'two line');
	t.is(terminal.state.getLine(2).str, 'red line');
	t.is(terminal.state.getLine(3).str, '');
	log('one line\ntwo line\nred line\nblue line');
	t.is(terminal.state.getLine(0).str, 'two line');
	t.is(terminal.state.getLine(1).str, 'red line');
	t.is(terminal.state.getLine(2).str, 'blue line');
	t.is(terminal.state.getLine(3).str, ''); // Always a blank last line
});

test('growing output from top', t => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	log('blue line');
	t.is(terminal.state.getLine(0).str, 'blue line');
	log('red line\nblue line');
	t.is(terminal.state.getLine(0).str, 'red line');
	t.is(terminal.state.getLine(1).str, 'blue line');
	log('two line\nred line\nblue line');
	t.is(terminal.state.getLine(0).str, 'two line');
	t.is(terminal.state.getLine(1).str, 'red line');
	t.is(terminal.state.getLine(2).str, 'blue line');
	t.is(terminal.state.getLine(3).str, '');
	log('one line\ntwo line\nred line\nblue line');
	t.is(terminal.state.getLine(0).str, 'two line');
	t.is(terminal.state.getLine(1).str, 'red line');
	t.is(terminal.state.getLine(2).str, 'blue line');
	t.is(terminal.state.getLine(3).str, ''); // Always a blank last line
});

test('shrinking output', t => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	log('one line\ntwo line\nred line\nblue line');
	t.is(terminal.state.getLine(0).str, 'two line');
	t.is(terminal.state.getLine(1).str, 'red line');
	t.is(terminal.state.getLine(2).str, 'blue line');
	t.is(terminal.state.getLine(3).str, ''); // Always a blank last line
	log('one line\ntwo line\nred line');
	t.is(terminal.state.getLine(0).str, 'one line');
	t.is(terminal.state.getLine(1).str, 'two line');
	t.is(terminal.state.getLine(2).str, 'red line');
	t.is(terminal.state.getLine(3).str, '');
	log('one line\ntwo line');
	t.is(terminal.state.getLine(0).str, 'one line');
	t.is(terminal.state.getLine(1).str, 'two line');
	log('one line');
	t.is(terminal.state.getLine(0).str, 'one line');
});

test('lots of updates', t => {
	const {terminal, log} = setup({rows: 4, columns: 20});

	for (let i = 0; i < 100; i++) {
		log([
			`[1] ${(i ** 3) + 11}`,
			`[2] ${(i ** 2) + (10 * i) - 100}`,
		].join('\n'));
	}

	t.is(terminal.state.getLine(0).str, '[1] 970310');
	t.is(terminal.state.getLine(1).str, '[2] 10691');
});

test('log.done', t => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('Fun families are all similar');
	log('Happy families are all similar');
	log.done();
	log('Happy families are all alike; every unhappy family has its own way');
	log('Happy families are all alike; every unhappy family is unhappy in its own way');
	log.done();
	t.is(terminal.state.getLine(0).str, 'Happy families are all similar');
	t.is(terminal.state.getLine(1).str, 'Happy families are all alike; every unhappy family is unhappy in its own way');
});

test('log.clear', t => {
	const {terminal, log} = setup({rows: 10, columns: 80});

	log('Info');
	log.clear();
	log.done();
	log('Second Info');
	t.is(terminal.state.getLine(0).str, 'Second Info');
});

test('clear after hard wrapped text', t => {
	const {terminal, log} = setup({rows: 10, columns: 20});

	// Log text that will be hard wrapped
	log('This is a very long line that will be hard wrapped across multiple terminal lines');
	// The text should be wrapped across multiple lines
	t.is(terminal.state.getLine(0).str, 'This is a very long ');
	t.is(terminal.state.getLine(1).str, 'line that will be ha');
	t.is(terminal.state.getLine(2).str, 'rd wrapped across mu');
	t.is(terminal.state.getLine(3).str, 'ltiple terminal line');
	t.is(terminal.state.getLine(4).str, 's');

	// Now update with shorter text
	log('Short text');
	// The previous wrapped lines should be cleared
	t.is(terminal.state.getLine(0).str, 'Short text');
	t.is(terminal.state.getLine(1).str, '');
	t.is(terminal.state.getLine(2).str, '');
	t.is(terminal.state.getLine(3).str, '');
	t.is(terminal.state.getLine(4).str, '');
});

test('clear after hard wrapped text with ANSI codes', t => {
	const {terminal, log} = setup({rows: 10, columns: 20});

	// Log text with ANSI codes that will be hard wrapped
	log('\u001B[32mThis is a very long green line that will be hard wrapped across multiple terminal lines\u001B[39m');

	// Now update with shorter text
	log('Short text');
	// The previous wrapped lines should be cleared
	t.is(terminal.state.getLine(0).str, 'Short text');
	t.is(terminal.state.getLine(1).str, '');
	t.is(terminal.state.getLine(2).str, '');
	t.is(terminal.state.getLine(3).str, '');
	t.is(terminal.state.getLine(4).str, '');
});

test('defaultWidth option used when stream has no columns', t => {
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
	t.is(terminal.state.getLine(0).str, 'This text should wrap at exact');
	t.is(terminal.state.getLine(1).str, 'ly 30 characters width');
});

test('defaultWidth not used when stream has columns', t => {
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
	t.is(terminal.state.getLine(0).str, 'This text is exactly');
	t.is(terminal.state.getLine(1).str, ' 35 characters');
});

test('defaultHeight option used when stream has no rows', t => {
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
	t.is(terminal.state.getLine(0).str, 'Line 4');
	t.is(terminal.state.getLine(1).str, 'Line 5');
	t.is(terminal.state.getLine(2).str, '');
});

test('defaultHeight not used when stream has rows', t => {
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
	t.is(terminal.state.getLine(0).str, 'Line 4');
	t.is(terminal.state.getLine(1).str, '');
});
