if(process.stdout.clearLine) {
    const startTime = Date.now();
    const time = ms => {
        const o = {
            d: Math.floor(ms / 86400000),
            h: Math.floor(ms / 3600000) % 24,
            m: Math.floor(ms / 60000) % 60,
            s: Math.floor(ms / 1000) % 60,
        }
        let str = '';
        for (const t in o)
            str += `${o[t]}${t} `;
        return str.trim() || '0s';
    };

    const mb = n => (n / 1024 / 1024).toFixed(1) + 'mb';

    const update = () => {
        const name = 'InfText';
        const uptime = 'Uptime: ' + time(Date.now() - startTime)
        const usage = process.memoryUsage();
        const mem = `heap: ${mb(usage.heapUsed)} / ${mb(usage.heapTotal)} rss: ${mb(usage.rss)} ext: ${mb(usage.external)} arr: ${mb(usage.arrayBuffers)}`
        const padding = ' '.repeat(Math.floor(process.stdout.columns / 2 - (name.length + uptime.length + mem.length + 2) / 2));

        process.stdout.write(padding + `\x1b[32m${name} \x1b[36m${uptime} \x1b[35m${mem}\x1b[0m`);
    }
    const log = console.log;
    console.log = function(...args) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        log.apply(null, args);
        update();
    }

    setInterval(() => {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        update();
    }, 1000)
}

import http from 'http'
import {WebSocketServer} from 'ws'
import fs from 'fs'
import Chunks from './chunks.mjs'
import Thumbnail from './thumbnail.mjs'
import Analytics from './analytics.mjs'
import crypto from 'crypto'
import Zlib from 'zlib';
import util from 'util'
import {CronJob} from 'cron'

process.on('uncaughtException', err => {
    const stream = fs.createWriteStream('./err.out', {flags: 'a', encoding: 'utf-8'});
    stream.write(`\n[${new Date().toUTCString()}][EXCEPTION] ${err.stack || err.message}\n`, () => process.exit(1));
});

process.on('unhandledRejection', (val, promise) => {
    const stream = fs.createWriteStream('./err.out', {flags: 'a', encoding: 'utf-8'});
    stream.write(`\n[${new Date().toUTCString()}][REJECTION] ${util.inspect(val, true, Infinity, false)} - ${util.inspect(promise, true, Infinity, false)}\n`, () => stream.close());
})

new CronJob('0 0 0 * * *', () => {
    Chunks.backupAll();
}, null, true, null, null, false, 0);

const config = JSON.parse(fs.readFileSync('./config.json', {encoding: 'utf-8'}));

const allowedMethods = ['HEAD', 'GET', 'POST', 'OPTIONS'];

const paths = {
    '/style.css': ['style.css', 'text/css'],
    '/favicon.ico': ['favicon.ico', 'image/x-icon'],
    '/favicon.png': ['favicon.png', 'image/png'],
    '/draw.mjs': ['draw.mjs', 'application/javascript; charset=utf-8'],
    '/camera.mjs': ['camera.mjs', 'application/javascript; charset=utf-8'],
    '/caret.mjs': ['caret.mjs', 'application/javascript; charset=utf-8'],
    '/chunk.mjs': ['chunk.mjs', 'application/javascript; charset=utf-8'],
    '/letter.mjs': ['letter.mjs', 'application/javascript; charset=utf-8'],
    '/hud.mjs': ['hud.mjs', 'application/javascript; charset=utf-8'],
    '/help.mjs': ['help.mjs', 'application/javascript; charset=utf-8'],
    '/socket.mjs': ['socket.mjs', 'application/javascript; charset=utf-8']
}

if(config.cache) for(const path in paths) {
    Zlib.deflateRaw(fs.readFileSync(`../static/${paths[path][0]}`), (e, buf) => {
        paths[path][0] = buf;
    });
}

const hearbeatDuration = 5000;
const server = http.createServer((req, res) => {
    const headers = {
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5',
        'Server': 'InfText',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': allowedMethods.join(', '),
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
    }
    const reject = code => {
        headers['Content-Type'] = 'text/html; charset=utf-8'
        res.writeHead(code, headers);
        res.write(`<h1>${code}</h1><h2>${http.STATUS_CODES[code]}</h2>`);
        res.end();
    }

    const doNotTrack = typeof req.headers['dnt'] != 'undefined' && req.headers['dnt'] == '1';
    headers['Tk'] = doNotTrack ? 'N' : 'P';

    try {
        let isHead = false;
        switch(req.method.toUpperCase()) {
            case 'HEAD' :
                isHead = true;
            case 'GET' :
                const url = req.url.replace(/^\/@(-?\d+),(-?\d+)($|\/)/, '/');
                switch(url) {
                    case '/gateway' :
                        headers['Content-Type'] = 'application/json';
                        const body = JSON.stringify({
                            url: `ws${config.ssl ? 's' : ''}://${config.domain}:${config.port}`,
                            heartbeat: hearbeatDuration
                        })
                        res.writeHead(200, headers);
                        headers['Content-Length'] = Buffer.byteLength(body);
                        if(!isHead) res.write(body);
                        res.end();
                        break;
                    case '/thumbnail' :
                        const [, x, y] = req.url.match(/^\/@(-?\d+),(-?\d+)($|\/)/) || [, 0, 0];
                        Thumbnail.getThumbnail(+x, +y).then(data => {
                            headers['Content-Type'] = 'image/png';
                            headers['Content-length'] = Buffer.byteLength(data);
                            res.writeHead(200, headers);
                            if(!isHead) res.write(data);
                            res.end();
                            Analytics.insert(req);
                        }).catch(err => {
                            console.error(err);
                            reject(500);
                        });
                        break;
                    case '/' :
                        const title = 'InfText';
                        const desc = 'An infinite canvas of text to edit and explore! All changes and edits you make are visible to all other visitors in real time!';
                        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="theme-color" content="${Thumbnail.colors[Chunks.defaultBackground]}">
    <meta name="robots" content="index, follow">
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="twitter:creator" content="@Caltrop256">
    <meta name="twitter:card" content="summary_large_image">
    <meta property="og:title" content="${title}">
    <meta property="twitter:title" content="${title}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://${config.domain}/">
    <meta property="og:description" content="${desc}">
    <meta property="twitter:description" content="${desc}">
    <meta property="og:site_name" content="${config.domain}">
    <meta property="og:image" content="https://${config.domain}${req.url}${req.url.endsWith('/') ? '' : '/'}thumbnail">
    <title>./${title.toLowerCase()}</title>
    <link rel="stylesheet" href="style.css">
    <link rel="shortcut icon" type="image/png" href="favicon.png" />
    <link rel="icon" type="image/png" href="favicon.png" />
</head>
<body>
    <div class="terminal">
        <p><span class="green">[root@${config.domain} </span>~<span class="green">]$</span> ./inftext</p>
        <noscript>
            <p><span class="red">[ERR]</span> javascript disabled!</p>
            <p><span class="red">[ERR]</span> InfText requires javascript for rendering the screen and interacting with other players</p>
            <p><span class="red">[ERR]</span> we do not use javascript for tracking or cookies, and honor the DoNotTrack header</p>
            <p><span class="red">[ERR]</span> try enabling javascript and reloading the page!</p>
            <br>
            <p>exited with code -1668641893 (0x63757465)</p>
            <br>
            <br>
            <span><span class="green">[root@${config.domain} </span>~<span class="green">]$</span> <span>
        </noscript>
        <span id="caret" class="caret">&nbsp;</span>
        <p class="hidden"><span class="blue">[INFO]</span> loading resources...</p>
        <script>
            const reveal = function(i) {
                const el = document.getElementsByClassName('hidden')[i]; 
                el.style.display = 'block';
                document.getElementById('caret').remove();
                el.insertAdjacentHTML('beforeend', '<span id="caret" class="caret">&nbsp;</span>');
                return el;
            };
            window.onerror = function(message, source, lineno, colno) {
                window.onerror = null;
                reveal(3);
                reveal(4).innerHTML += source.substring(source.lastIndexOf('/') + 1) + ' > ' + 'ln: ' + lineno + ' col: ' + colno + ' - ' + message;
                reveal(4);
                reveal(5);
            }
            reveal(0);
        </script>
        <p class="hidden"><span class="blue">[INFO]</span> connecting...</p>
        <p class="hidden"><span class="blue">[INFO]</span> drawing chunks...</p>
        <p class="hidden"><span class="red">[ERR]</span> an error occured while loading the page, your browser may be out of date<br></p>
        <p class="hidden"><span class="red">[ERR]</span> </p>
        <p class="hidden"><span class="green">[root@${config.domain} </span>~<span class="green">]$</span> </p>
    </div>
    <script defer type="module" src="./draw.mjs"></script>
</body>
</html>`;
                        headers['Content-Type'] = 'text/html';
                        headers['Content-Length'] = Buffer.byteLength(html);
                        res.writeHead(200, headers);
                        if(!isHead) res.write(html);
                        res.end();
                        Analytics.insert(req);
                        break;
                    default :
                        if(!paths[url]) return reject(404);

                        const [path, type] = paths[url];
                        if(config.cache) {
                            headers['Content-Type'] = type;
                            headers['Content-Length'] = Buffer.byteLength(path);
                            headers['Content-Encoding'] = 'deflate';
                            res.writeHead(200, headers);
                            if(!isHead) res.write(path);
                            res.end();
                        } else {
                            fs.readFile(`../static/${path}`, type.startsWith('image/') ? null : {encoding: 'utf-8'}, (err, data) => {
                                if(err) {
                                    console.log(err);
                                    return reject(500);
                                }
                                headers['Content-Type'] = type;
                                headers['Content-Length'] = Buffer.byteLength(data);
                                res.writeHead(200, headers);
                                if(!isHead) {
                                    res.write(data);
                                }
                                res.end();
                            });
                        }
                        break;
                }
                break;
            case 'POST' :
                reject(404);
                break;
            case 'OPTIONS' :
                headers['Allow'] = allowedMethods.join(', ');
                res.writeHead(204, headers);
                res.end();
                break;
            default :
                headers['Allow'] = allowedMethods.join(', ');
                return reject(405);
        }
    } catch(err) {
        console.error(err);
        reject(500);
    }
});

server.listen(config.port, '127.0.0.1', () => {
    console.log('Now online on port:', config.port, '!');
})
const terminate = (socket, reason) => {
    console.error(reason);
    socket.terminate();
    if(socket.pos === null) return;
    ws.clients.forEach(s => {
        if(Array.from(s.claimedChunks).some(c => c == socket.pos.id)) s.send(JSON.stringify({ln: null, col: null, id: socket.id}));
    })
}
const ws = new WebSocketServer({server});

const sweep = () => {
    const claimed = new Set();
    ws.clients.forEach(s => {
        if(s.claimedChunks && s.claimedChunks.size) {
            for(const k of s.claimedChunks) claimed.add(k);
        }
    })
    const redundant = [];
    let swept = 0;
    for(const [id, chunk] of Chunks.cache) {
        if(claimed.has(id)) continue;
        if(Chunks.chunkIsNotEmpty(chunk)) {
            redundant.push({id, chunk});
        }
        swept += 1;
        Chunks.cache.delete(id);
    }
    if(redundant.length) Chunks.storeChunksInDatabase(redundant)
        .then(() => console.log(`stored ${redundant.length} chunks! (${swept} total swept)`))
        .catch(console.error);
    else if(swept) console.log(`swept ${swept} empty chunks!`);
}

ws.on('listening', () => console.log('Websocket Server online!'));
ws.on('connection', socket => {
    socket.lastHeartbeat = Date.now();
    socket.claimedChunks = new Set();
    socket.pos = null;
    socket.id = crypto.randomUUID();
    socket.allowedCharacters = 85;
    
    socket.send(JSON.stringify({online: ws.clients.size}));

    socket.on('message', raw => {
        try {
            const data = JSON.parse(raw.toString('utf-8'));
            const isInt = n => typeof n == 'number' && n == n && n == Math.trunc(n);
            if(typeof data.pos == 'object' && data.pos != null && isInt(data.pos.ln) && isInt(data.pos.col)) {
                if(socket.pos == null) socket.pos = {};
                socket.pos.prevLn = socket.pos.ln;
                socket.pos.prevCol = socket.pos.col;
                socket.pos.ln = data.pos.ln;
                socket.pos.col = data.pos.col;
            } else if(data.pos === null) {
                if(socket.pos === null) return;
                ws.clients.forEach(s => {
                    if(Array.from(s.claimedChunks).some(c => c == socket.pos.id)) s.send(JSON.stringify({ln: null, col: null, id: socket.id}));
                })
                socket.pos = null;
            } else if(typeof data.ping == 'number') {
                socket.lastHeartbeat = Date.now();
            } else if(typeof data.added != 'undefined' && Array.isArray(data.added) && typeof data.removed != 'undefined' && Array.isArray(data.removed)) {
                for(const id of data.removed) {
                    socket.claimedChunks.delete(id);
                }
                const requestedChunks = [];
                for(const id of data.added) {
                    if(!/^-?\d+,-?\d+$/.test(id)) terminate(socket, 'claimed invalid chunk id');
                    if(!socket.claimedChunks.has(id)) {
                        requestedChunks.push(id);
                        socket.claimedChunks.add(id)
                    }
                }

                const carets = [];
                ws.clients.forEach(s => {
                    if(s.pos == null) return;
                    if(requestedChunks.some(c => s.id != socket.id && c == s.pos.id)) carets.push(s);
                })
                carets.forEach(c => {
                    socket.send(JSON.stringify({ln: c.pos.ln, col: c.pos.col, id: c.id}));
                })

                if(requestedChunks.length) Chunks.getChunks(requestedChunks).then(chunks => {
                    socket.send(Chunks.serializeChunkSequence(chunks));
                }).catch(console.error);
            } else if(typeof data.update != 'undefined' && Array.isArray(data.update)) {
                socket.allowedCharacters -= data.update.length;
                if(socket.allowedCharacters < 0) return;

                for(const char of data.update) {
                    if(typeof char.col != 'number' || typeof char.ln != 'number' || typeof char.id != 'string' || typeof char.code != 'number') return;
                    if(char.col < 0 || char.col >= Chunks.chunkWidth) return;
                    if(char.ln < 0 || char.ln >= Chunks.chunkHeight) return;
                    if(char.code < 0 || char.code > 0xffffff) return;
                    if(!/^-?\d+,-?\d+$/.test(char.id)) return;
                }
                Chunks.processUpdates(data.update).then(chunks => {
                    ws.clients.forEach(s => {
                        const ch = data.update.filter(u => s.claimedChunks.has(u.id));
                        if(ch.length) s.send(JSON.stringify({patch: ch}));
                    });
                }).catch(console.error);
            } else {
                console.log(data);
                terminate(socket, 'send invalid data');
            }
        } catch(e) {
            console.error(e);
            terminate(socket, 'caused error');
        }
    });

    socket.on('close', () => {
        if(socket.pos === null) return;
        ws.clients.forEach(s => {
            if(Array.from(s.claimedChunks).some(c => c == socket.pos.id)) s.send(JSON.stringify({ln: null, col: null, id: socket.id}));
        })
    })
})

setInterval(() => {
    ws.clients.forEach(socket => {
        if(socket.pos == null) return;
        if(socket.pos.ln == socket.pos.prevLn && socket.pos.prevCol == socket.pos.col) return;

        const id = Math.floor(socket.pos.col / 50) + ',' + Math.floor(socket.pos.ln / 25);
        const prevId = socket.pos.id;
        const jsonPos = JSON.stringify({ln: socket.pos.ln, col: socket.pos.col, id: socket.id});
        const jsonNoFocus = JSON.stringify({ln: null, col: null, id: socket.id});

        ws.clients.forEach(s => {
            if(s.id == socket.id) return;

            if(s.claimedChunks.has(id)) {
                s.send(jsonPos);
            } else if(s.claimedChunks.has(prevId)) {
                s.send(jsonNoFocus);
            }
        });

        socket.pos.prevLn = socket.pos.ln;
        socket.pos.prevCol = socket.pos.col;
        socket.pos.id = id;
    });
}, 1000 / 15);

setInterval(() => {
    const now = Date.now();
    const json = JSON.stringify({online: ws.clients.size});
    ws.clients.forEach(socket => {
        if(now - socket.lastHeartbeat > hearbeatDuration * 2) {
            console.log(now - socket.lastHeartbeat);
            terminate(socket, 'failed ping check');
        } else {
            socket.send(json);
            socket.allowedCharacters = Math.min(85 * 4, socket.allowedCharacters += 50);
        }
    })
    if(Chunks.cache.size >= 3000) sweep();
}, hearbeatDuration)