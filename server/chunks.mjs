import mysql from 'mysql';
import fs from 'fs';
import constantChunks from './constant-chunks.mjs';

const config = JSON.parse(fs.readFileSync('./config.json', {encoding: 'utf-8'}));

const con = mysql.createConnection(config.mysql.chunks);

const exp = {}

const chunkWidth = 50;
const chunkHeight = 25;
const defaultBackground = 0;
const defaultForeground = 15;
const cache = new Map();

const charToCode = (char, fg, bg) => char.charCodeAt(0) | (fg << 16) | (bg << 20);

/*
    0xf   f   f   ffff
      ^rl ^bg ^fg ^char
*/ 
const encodeChunk = chunk => {
    const buffer = new Uint32Array(chunk.length);
    let len = 0;

    let val = chunk[0];
    let n = 1;
    for(let i = 1; i < chunk.length; ++i) {
        if(n == 256 || chunk[i] != val) {
            buffer[len++] = val | ((n - 1) << 24);
            val = chunk[i];
            n = 1;
        } else {
            n += 1
        }
    }
    buffer[len++] = val | ((n - 1) << 24);

    const out = new Uint32Array(len);
    while(len --> 0) out[len] = buffer[len];
    return out;
}
const decodeChunk = buffer => {
    const chunk = new Uint32Array(chunkWidth * chunkHeight);
    let i = 0;
    let k = 0;
    while(i < chunk.length) {
        let j = (buffer[k] >>> 24) + 1;
        const val = buffer[k++] &= 0xffffff;
        while(j --> 0) chunk[i++] = val;
    }
    return chunk;
}

const createEmptyChunk = () => {
    return new Uint32Array(chunkWidth * chunkHeight).fill(charToCode(' ', 15, 0))
}

const storeChunksInDatabase = chunks => {
    if(!chunks.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
        let query = 'INSERT INTO `chunks` (`x`, `y`, `data`) VALUES ';
        query += new Array(chunks.length).fill('(?,?,?)').join(', ');
        query += ' ON DUPLICATE KEY UPDATE `data` = VALUES(`data`);'
    
        const escape = [];
        for(const chunk of chunks) {
            const [x, y] = chunk.id.split(',');
            escape.push(x, y, Buffer.from((encodeChunk(chunk.chunk).buffer)));
        }
        con.query(query, escape, (err, res) => {
            if(err) return reject(err);
            resolve(res);
        });
    })
}

exp.getChunks = ids => new Promise((resolve, reject) => {
    const chunks = [];
    const notInCache = [];
    for(const id of ids) {
        if(constantChunks.has(id)) chunks.push({id, chunk: constantChunks.get(id)});
        else if(cache.has(id)) chunks.push({id, chunk: cache.get(id)});
        else notInCache.push(id);
    }

    if(notInCache.length) {
        let query = 'SELECT * from `chunks` WHERE ';
        query += new Array(notInCache.length).fill('(`x` = ? AND `y` = ?)').join(' OR ') + ';';
        const escape = [];
        for(const id of notInCache) {
            const [x, y] = id.split(',').map(Number);
            escape.push(x, y);
        }
        con.query(query, escape, (err, res) => {
            if(err) return reject(err);
            for(const row of res) {
                const chunkData = decodeChunk(new Uint32Array(row.data.buffer));
                const id = row.x + ',' + row.y;
                if(cache.has(id)) {
                    chunks.push({id, chunk: cache.get(id)});
                } else {
                    cache.set(id, chunkData);
                    chunks.push({id, chunk: chunkData});
                }
                notInCache.splice(notInCache.indexOf(id), 1);
            }
            for(const id of notInCache) {
                const chunk = createEmptyChunk();
                chunk.__empty = true;
                cache.set(id, chunk);
                chunks.push({id, chunk});
            }
            return resolve(chunks);
        });
    } else return resolve(chunks);
});

exp.processUpdates = updates => new Promise((resolve, reject) => {
    exp.getChunks([...new Set(updates.map(c => c.id).filter(id => !constantChunks.has(id)))]).then(chunks => {
        for(const char of updates) {
            for(const chunk of chunks) {
                if(char.id == chunk.id) {
                    chunk.chunk[char.ln * chunkWidth + char.col] = char.code;
                    chunk.chunk.__empty = false;
                    break;
                }
            }
        }
        resolve(chunks);
    }).catch(reject);
})

const chunkIsNotEmpty = data => {
    return !data.__empty;

    if(data.__empty) return false;
    for(let i = 0; i < data.length; ++i) {
        if(data[i] >> 20 != defaultBackground) return true;
        if((data[i] >> 16) & 0xf != defaultForeground) return true;
        if(!/\s/.test(String.fromCharCode(data[i] & 0x00ffff))) return true;
    }
    return false;
}

exp.serializeChunkSequence = chunks => {
    chunks = chunks.sort(({id: a}, {id: b}) => {
        const [x0, y0] = a.split(',').map(Number);
        const [x1, y1] = b.split(',').map(Number);
        if(y0 < y1) return -1;
        else if(y0 > y1) return 1;
        else if(x0 < x1) return -1;
        else if(x0 > x1) return 1;
        else return 0;
    })

    const headLength = chunks.length * 5 + 1;
    const head = new Uint32Array(headLength);
    let hI = 0;
    head[hI++] = chunks.length;

    let bodyLength = 1;
    for(const chunk of chunks) {
        const [x, y] = chunk.id.split(',').map(s => BigInt(s) + 9223372036854775808n);
        head[hI++] = Number(x & 0xffffffffn);
        head[hI++] = Number(x >> 32n);
        head[hI++] = Number(y & 0xffffffffn);
        head[hI++] = Number(y >> 32n);

        if(chunk.chunk.__empty) head[hI++] = 0;
        else {
            chunk.chunk = encodeChunk(chunk.chunk);
            head[hI++] = bodyLength;
            bodyLength += chunk.chunk.length;
        }
    }
    const body = new Uint32Array(bodyLength);
    let bI = 0;
    body[bI++] = 1009990707;
    for(const chunk of chunks) {
        if(chunk.chunk.__empty) continue;
        for(let j = 0; j < chunk.chunk.length; ++j) {
            body[bI++] = chunk.chunk[j];
        }
    }

    const hBuf = new Uint8Array(head.buffer);
    const bBuf = new Uint8Array(body.buffer);
    let bbI = bBuf.byteLength;
    let bhI = hBuf.byteLength;
    let len = bbI + bhI;
    const out = Buffer.alloc(len);
    while(bbI --> 0) out[--len] = bBuf[bbI];
    while(bhI --> 0) out[--len] = hBuf[bhI];

    return out;
}

const indexIntoChunkSequence = (sequence, set) => {
    const chunkLen = chunkWidth * chunkHeight;
    const u32 = new Uint32Array(sequence.buffer);
    let hI = 0;
    const chunks = u32[hI++];
    const head = new Map();
    const headLen = chunks * 5 + 1;
    while(hI < headLen) {
        head.set(
            ((BigInt(u32[hI++]) | ((BigInt(u32[hI++])) << 32n)) - 9223372036854775808n)
            + ',' + ((BigInt(u32[hI++]) | ((BigInt(u32[hI++])) << 32n)) - 9223372036854775808n),
            u32[hI++]
        )
    }

    const out = [];
    let ind;
    for(const id of set) {
        if(ind = head.get(id)) {
            let bI = ind + headLen;
            let n = 0;
            let j = 0;
            while(j < chunkLen) {
                j += (u32[bI++] >>> 24) + 1;
                n += 1;
            }
            out.push({id, chunk: new Uint32Array(u32, bI * 4, n)});
        } else out.push({id, chunk: {__empty: true}});
    }
    return out;
}

/*exp.serializeChunkSequence = chunks => {
    let totalLen = 0;
    for(const chunk of chunks) {
        if(chunk.chunk.__empty) chunk.chunk = new Uint32Array([0, 0]);
        else chunk.chunk = encodeChunk(chunk.chunk);
        totalLen += chunk.chunk.length;
    }

    const u32 = new Uint32Array(totalLen + chunks.length * 4);

    let i = 0;
    const addU64 = (s) => {
        const n = BigInt(s) + 9223372036854775808n;
        u32[i++] = Number(n & 0xffffffffn);
        u32[i++] = Number(n >> 32n);
    };
    for(const chunk of chunks) {
        chunk.id.split(',').forEach(addU64);
        for(let j = 0; j < chunk.chunk.length; ++j) {
            u32[i++] = chunk.chunk[j];
        }
    }

    return Buffer.from(u32.buffer);
}*/

const storeNonEmpty = () => {
    const toStore = [];
    for(const [k, v] of cache) {
        if(chunkIsNotEmpty(v)) toStore.push({id: k, chunk: v});
    }
    cache.clear();
    return storeChunksInDatabase(toStore);
}

setInterval(() => {
    console.log("Storing " + cache.size + " chunks!");
    storeNonEmpty().catch(console.error);
}, 1000 * 60 * 10);

exp.backupAll = () => {
    con.query('SELECT * FROM `chunks`', (err, res) => {
        const chunks = new Map(Array.from(cache).filter((_,c) => !c.__empty));
        for(const row of res) {
            const chunkData = decodeChunk(new Uint32Array(row.data.buffer));
            const id = row.x + ',' + row.y;
            if(!chunks.has(id)) chunks.set(id, chunkData);
        }
        const buf = exp.serializeChunkSequence(Array.from(chunks).map(([id, data]) => ({id, chunk: data})));
        if(!fs.existsSync('./backups')) fs.mkdirSync('backups');
        const d = new Date(Date.now() - 86400000 / 2);
        fs.writeFile(`./backups/h-${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}.chunks`, buf, (err) => {
            if(err) console.error(err);
            else console.log(`Backed up ${chunks.size} chunks!`);
        })
    });
}

exp.chunkWidth = chunkWidth;
exp.chunkHeight = chunkHeight;
exp.defaultBackground = defaultBackground;
exp.defaultForeground = defaultForeground;
exp.cache = cache;
exp.storeChunksInDatabase = storeChunksInDatabase;
exp.chunkIsNotEmpty = chunkIsNotEmpty;

export default exp;

process.on('message', e => {
    console.log(e);
})

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
    storeNonEmpty()
    .then(() => process.stdout.write('\nsuccessfuly stored all chunks!\n'))
    .catch(console.error)
    .finally(() => {
        process.exit(0);
    });
});