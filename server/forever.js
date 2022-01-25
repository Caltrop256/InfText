const proc = new (require('forever-monitor').Monitor)('./app.mjs', {
    max: Infinity
});
proc.on('restart', () => console.log('[RESTARTING]'));

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
    proc.kill(true);
    setTimeout(() => {
        process.exit();
    }, 500)
});
proc.start();