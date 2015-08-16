'use strict';
var logUpdate = require('./');

var i = 0;
var int = setInterval(function () {
	i++;

	var ret = '[1]  ' + Math.random();

	if (i < 10) {
		ret += ' ~ ' + Math.random();
	}

	ret += '\n[2]  ' + Math.random();

	logUpdate(ret);
}, 100);

setTimeout(logUpdate.done, 1000);
setTimeout(logUpdate.done, 3000);

setTimeout(function () {
	clearInterval(int);
	logUpdate.clear();
}, 4000);

setTimeout(process.exit, 4100);
