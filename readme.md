# log-update [![Build Status](https://travis-ci.org/sindresorhus/log-update.svg?branch=master)](https://travis-ci.org/sindresorhus/log-update)

> Log by overwriting the previous output in the terminal.<br>
> Useful for rendering progress bars, animations, etc.

![](screenshot.gif)


## Install

```
$ npm install log-update
```


## Usage

```js
const logUpdate = require('log-update');
const frames = ['-', '\\', '|', '/'];
let i = 0;

setInterval(() => {
	const frame = frames[i = ++i % frames.length];

	logUpdate(
`
        ♥♥
   ${frame} unicorns ${frame}
        ♥♥
`
	);
}, 80);
```


## API

### logUpdate(text, ...)

Log to stdout.

### logUpdate.clear()

Clear the logged output.

### logUpdate.done()

Persist the logged output.<br>
Useful if you want to start a new log session below the current one.

### logUpdate.stderr(text, ...)

Log to stderr.

### logUpdate.stderr.clear()
### logUpdate.stderr.done()

### logUpdate.create(stream, options)

Get a `logUpdate` method that logs to the specified stream.
Additionally, `logUpdate.create()` method accepts `showCursor` option, which determines whether to show a cursor or not. By default, the cursor is hidden.
Showing a cursor is useful when a CLI accepts input from a user.

```js
// Write output, but don't hide a cursor
const log = logUpdate.create(process.stdout, {
	showCursor: true
});
```


## Examples

- [listr](https://github.com/SamVerschueren/listr) - Uses this module to render an interactive task list
- [ora](https://github.com/sindresorhus/ora) - Uses this module to render awesome spinners
- [speed-test](https://github.com/sindresorhus/speed-test) - Uses this module to render a [spinner](https://github.com/sindresorhus/elegant-spinner)


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
