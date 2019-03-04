import logUpdate, {stderr, create} from '.';

logUpdate(`
        ♥♥
     unicorns
        ♥♥
`);

logUpdate.clear();
logUpdate.done();

stderr('oh', 'my', 'oh', 'my');
stderr.clear();
stderr.done();

const logStdOut = create(process.stdout);
create(process.stdout, {showCursor: true});
logStdOut('oh', 'my', 'oh', 'my');
logStdOut.clear();
logStdOut.done();
