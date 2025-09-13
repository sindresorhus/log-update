# log-update

> Log by overwriting the previous output in the terminal.\
> Useful for rendering progress bars, animations, etc.

![](screenshot.gif)

It performs partial redraws when possible to reduce flicker.

## Install

```sh
npm install log-update
```

## Usage

```js
import logUpdate from 'log-update';

const frames = ['-', '\\', '|', '/'];
let index = 0;

setInterval(() => {
	const frame = frames[index = ++index % frames.length];

	logUpdate(
`
        ♥♥
   ${frame} unicorns ${frame}
        ♥♥
`
	);
}, 80);
```

You can use [yoctocolors](https://github.com/sindresorhus/yoctocolors) or [chalk](https://github.com/chalk/chalk) to colorize the output.

## API

### logUpdate(text…)

Log to stdout.

### logUpdate.clear()

Clear the logged output.

### logUpdate.done()

Persist the logged output.

Useful if you want to start a new log session below the current one.

### logUpdate.persist(text…)

Write text to the terminal that persists, similar to `console.log()`.

Unlike the main `logUpdate()` method which updates in place, `persist()` writes to the terminal in a way that preserves the output in the scrollback history.

```js
import logUpdate from 'log-update';

// Update in place
logUpdate('Processing...');
logUpdate('Still processing...');

// Write permanent output
logUpdate.persist('✓ Task complete');

// Continue updating
logUpdate('Next task...');
```

### logUpdateStderr(text…)

Log to stderr.

### logUpdateStderr.clear()
### logUpdateStderr.done()
### logUpdateStderr.persist(text…)

### createLogUpdate(stream, options?)

Get a `logUpdate` method that logs to the specified stream.

#### options

Type: `object`

##### showCursor

Type: `boolean`\
Default: `false`

Show the cursor. This can be useful when a CLI accepts input from a user.

```js
import {createLogUpdate} from 'log-update';

// Write output but don't hide the cursor
const log = createLogUpdate(process.stdout, {
	showCursor: true
});
```

##### defaultWidth

Type: `number`\
Default: `80`

The width to use when the stream doesn't provide a `columns` property.

This is useful when the output is piped, redirected, or in environments where the terminal size is not available.

```js
import {createLogUpdate} from 'log-update';

// Use custom width when the stream doesn't provide columns
const log = createLogUpdate(process.stdout, {
	defaultWidth: 120
});
```

##### defaultHeight

Type: `number`\
Default: `24`

The height to use when the stream doesn't provide a `rows` property.

This is useful when the output is piped, redirected, or in environments where the terminal size is not available.

```js
import {createLogUpdate} from 'log-update';

// Use custom height when the stream doesn't provide rows
const log = createLogUpdate(process.stdout, {
	defaultHeight: 50
});
```

## Examples

- [listr](https://github.com/SamVerschueren/listr) - Uses this module to render an interactive task list
- [ora](https://github.com/sindresorhus/ora) - Uses this module to render awesome spinners
- [speed-test](https://github.com/sindresorhus/speed-test) - Uses this module to render a [spinner](https://github.com/sindresorhus/elegant-spinner)
