import process from 'node:process';
import logUpdate, {logUpdateStderr, createLogUpdate} from './index.js';

logUpdate(`
        ♥♥
     unicorns
        ♥♥
`);

logUpdate.clear();
logUpdate.done();

logUpdateStderr('oh', 'my', 'oh', 'my');
logUpdateStderr.clear();
logUpdateStderr.done();

const logStdOut = createLogUpdate(process.stdout);
createLogUpdate(process.stdout, {showCursor: true});
logStdOut('oh', 'my', 'oh', 'my');
logStdOut.clear();
logStdOut.done();
