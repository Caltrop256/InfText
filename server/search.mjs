import fs from 'fs';
import Zlib from 'zlib';

const ChunkWidth = 50;
const ChunkHeight = 25;
const chunkLen = ChunkWidth * ChunkHeight;

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

const needle = process.argv.splice(2).join(' ');

const files = fs.readdirSync('./backups/');
const latest = files[files.length - 1];
const chunks = readBackUp(latest.substring(2, 12));

const compareChars = (a, b) => a.replace(/\s+/g, ' ').toLowerCase() == b.replace(/\s+/g, ' ').toLowerCase();

for(const [k, chunk] of chunks) {
    const [cx, cy] = k.split(',').map(Number);

    for(let sty = 0; sty < ChunkHeight; ++sty) {
        const yOff = sty * ChunkWidth;
        checkingCanidates :
        for(let stx = 0; stx < ChunkWidth; ++stx) {
            let needlePos = 0;
            if(compareChars(String.fromCharCode(chunk[yOff + stx] & 0xffff), needle.charAt(needlePos))) {
                let str = needle.charAt(needlePos);
                let tx = stx;
                let lcx = cx;
                let data = chunk;

                while(str != needle) {
                    needlePos += 1;
                    tx += 1;
                    if(tx >= ChunkWidth) {
                        tx = 0;
                        lcx += 1;
                        data = chunks.get(lcx + ',' + cy);
                        if(!data) continue checkingCanidates;
                    }

                    const char = String.fromCharCode(data[yOff + tx] & 0xffff);
                    if(!compareChars(char, needle.charAt(needlePos))) continue checkingCanidates;
                    str += char;
                }

                console.log(`@${cx * ChunkWidth + stx},${cy * ChunkHeight + sty}`);
            }
        }
    }
}
