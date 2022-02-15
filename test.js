'use strict';
const logUpdate = require('.');

let i = 0;
const int = setInterval(() => {
	i++;

	let ret = `[1]  ${Math.random()}`;

	if (i < 10) {
		ret += ` ~ ${Math.random()}`;
	}

	ret += `\n[2]  ${Math.random()}`;

	logUpdate(ret);
}, 100);

setTimeout(logUpdate.done, 1000);

setTimeout(() => {
	console.log('some log');
	console.error('some error');
}, 2000);

setTimeout(logUpdate.done, 3000);

setTimeout(() => {
	clearInterval(int);
	logUpdate.clear();
}, 4000);

setTimeout(process.exit, 4100);
