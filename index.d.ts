/// <reference types="node"/>
import {Writable} from 'stream';

/**
 * Get a `logUpdate` method that logs to the specified stream.
 *
 * @param stream - The stream to log to.
 */
export function create(stream: Writable, options?: Options): LogUpdate;

export interface LogUpdate {
	(...text: string[]): void;

	/**
	 * Clear the logged output.
	 */
	clear(): void;

	/**
	 * Persist the logged output. Useful if you want to start a new log session below the current one.
	 */
	done(): void;
}

/**
 * Log to `stdout` by overwriting the previous output in the terminal.
 *
 * @param text - The text to log to `stdout`.
 */
declare const logUpdate: LogUpdate & {
	/**
	 * Log to `stderr` by overwriting the previous output in the terminal.
	 *
	 * @param text - The text to log to `stderr`.
	 */
	stderr: LogUpdate;

	/**
	 * Get a `logUpdate` method that logs to the specified stream.
	 *
	 * @param stream - The stream to log to.
	 */
	create: typeof create;
};

export default logUpdate;

/**
 * Log to `stderr` by overwriting the previous output in the terminal.
 *
 * @param text - The text to log to `stderr`.
 */
export const stderr: LogUpdate;

export interface Options {
	/**
	 * Show the cursor. This can be useful when a CLI accepts input from a user.
	 *
	 * @example
	 *
	 * // Write output but don't hide the cursor
	 * const log = logUpdate.create(process.stdout, {
	 * 	showCursor: true
	 * });
	 */
	readonly showCursor?: boolean;
}
