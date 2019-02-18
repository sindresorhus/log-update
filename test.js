'use strict';
const test = require('ava');
const Terminal = require('terminal.js');
const logUpdate = require('.');

const setup = options => {
	const terminal = new Terminal(options);
	terminal.state.setMode('crlf', true);
	const log = logUpdate.create(terminal);
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
			`[2] ${(i ** 2) + (10 * i) - 100}`
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
