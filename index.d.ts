export type Options = {
	/**
	Show the cursor. This can be useful when a CLI accepts input from a user.

	@example
	```
	import {createLogUpdate} from 'log-update';

	// Write output but don't hide the cursor
	const log = createLogUpdate(process.stdout, {
		showCursor: true
	});
	```
	*/
	readonly showCursor?: boolean;

	/**
	The width to use when the stream doesn't provide a `columns` property. Defaults to `80`.

	This is useful when the output is piped, redirected, or in environments where the terminal size is not available.

	@default 80

	@example
	```
	import {createLogUpdate} from 'log-update';

	// Use custom width when the stream doesn't provide columns
	const log = createLogUpdate(process.stdout, {
		defaultWidth: 120
	});
	```
	*/
	readonly defaultWidth?: number;

	/**
	The height to use when the stream doesn't provide a `rows` property. Defaults to `24`.

	This is useful when the output is piped, redirected, or in environments where the terminal size is not available.

	@default 24

	@example
	```
	import {createLogUpdate} from 'log-update';

	// Use custom height when the stream doesn't provide rows
	const log = createLogUpdate(process.stdout, {
		defaultHeight: 50
	});
	```
	*/
	readonly defaultHeight?: number;
};

type LogUpdateMethods = {
	/**
	Clear the logged output.
	*/
	clear(): void;

	/**
	Persist the logged output. Useful if you want to start a new log session below the current one.
	*/
	done(): void;

	/**
	Write text to the terminal that persists in the scrollback buffer.

	Unlike the main log function which updates in place, this method writes output that remains in the terminal history, similar to `console.log()`. This is useful for displaying permanent results, status messages, or logs that users need to scroll back and review.

	@param text - The text to persist to the terminal.

	@example
	```
	import logUpdate from 'log-update';

	// Update in place
	logUpdate('Processing...');
	logUpdate('Still processing...');

	// Write permanent output
	logUpdate.persist('✓ Task complete');
	logUpdate.persist('✓ All tests passed');

	// Continue with updates
	logUpdate('Starting next task...');
	```
	*/
	persist(...text: string[]): void;
};

/**
Log to `stdout` by overwriting the previous output in the terminal.

@param text - The text to log to `stdout`.

@example
```
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
*/
declare const logUpdate: ((...text: string[]) => void) & LogUpdateMethods;

export default logUpdate;

/**
Log to `stderr` by overwriting the previous output in the terminal.

@param text - The text to log to `stderr`.

@example
```
import {logUpdateStderr} from 'log-update';

const frames = ['-', '\\', '|', '/'];
let index = 0;

setInterval(() => {
	const frame = frames[index = ++index % frames.length];

	logUpdateStderr(
`
		♥♥
${frame} unicorns ${frame}
		♥♥
`
	);
}, 80);
```
*/
declare const logUpdateStderr: ((...text: string[]) => void) & LogUpdateMethods;

export {logUpdateStderr};

/**
Get a `logUpdate` method that logs to the specified stream.

@param stream - The stream to log to.

@example
```
import {createLogUpdate} from 'log-update';

// Write output but don't hide the cursor
const log = createLogUpdate(process.stdout);
```
*/
export function createLogUpdate(
	stream: NodeJS.WritableStream,
	options?: Options
): typeof logUpdate;
