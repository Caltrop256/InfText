const proc = new (require('forever-monitor').Monitor)('./app.mjs', {
    max: Infinity
});
proc.on('restart', () => console.log('[RESTARTING]'));
proc.start();