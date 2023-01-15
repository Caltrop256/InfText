import fs from 'fs';
import Chunks from './chunks.mjs'
import Zlib from 'zlib';

const chunkLen = Chunks.chunkWidth * Chunks.chunkHeight;

const charToCode = (char, fg, bg) => char.charCodeAt(0) | (fg << 16) | (bg << 20);
const createEmptyChunk = () => new Uint32Array(chunkLen).fill(charToCode(' ', 15, 0));

const readBackUp = (timestamp) => {
    const raw = fs.readFileSync('./backups/h-' + timestamp + '.chunks');
    const unzipped = Zlib.gunzipSync(raw);
    const data = new Uint32Array(unzipped.buffer);
    
    let hI = 0;
    const nChunks = data[hI++];
    const headLength = nChunks * 5 + 1;
    
    const chunks = new Map();
    
    while(hI < headLength) {
        const x = (BigInt(data[hI++]) | ((BigInt(data[hI++])) << 32n)) - 9223372036854775808n;
        const y = (BigInt(data[hI++]) | ((BigInt(data[hI++])) << 32n)) - 9223372036854775808n;
        const ind = data[hI++];
        const id = x + ',' + y;
    
        if(!ind) chunks.set(id, createEmptyChunk());
        else {
            const chunkData = new Uint32Array(chunkLen);
            let j = 0;
            let bI = ind + headLength;
            while(j < chunkLen) {
                let k = (data[bI] >>> 24) + 1;
                const val = data[bI++] & 0xffffff;
                while(k --> 0) chunkData[j++] = val;
            }
            chunks.set(id, chunkData);
        }
    }

    return chunks;
}

const chunks = readBackUp('2023-01-14');
const old = readBackUp('2022-12-23');

for(const [k, v] of old) {
    if(!chunks.has(k)) chunks.set(k, v);
    else {
        const data = chunks.get(k);

        let i = chunkLen;
        while(i --> 0) {

            // if not whitespace
            if(String.fromCharCode(v[i] & 0xffff).trim().length || ((v[i] >> 20 & 0xf) != 0) /*|| String.fromCharCode(data[i] & 0xffff) == '█'*/) {
                data[i] = v[i];
            }
        }

        chunks.set(k, data);
    }
}


const toStore = [];
for(const [k, v] of chunks) {
    if(Chunks.chunkIsNotEmpty(v)) toStore.push({id: k, chunk: v});
}
Chunks.storeChunksInDatabase(toStore).then(console.log).catch(console.error);