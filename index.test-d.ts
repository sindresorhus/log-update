import logUpdate from '.';

logUpdate(`
        ♥♥
     unicorns
        ♥♥
`);

logUpdate.clear();
logUpdate.done();

logUpdate.stderr('oh', 'my', 'oh', 'my');
logUpdate.stderr.clear();
logUpdate.stderr.done();

const logStdOut = logUpdate.create(process.stdout);
logUpdate.create(process.stdout, {showCursor: true});
logStdOut('oh', 'my', 'oh', 'my');
logStdOut.clear();
logStdOut.done();
