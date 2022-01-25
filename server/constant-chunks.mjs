import Chunks from './chunks.mjs'
import fs from 'fs'

const defaultBackground = 0;
const defaultForeground = 15;
const rowSize = 50;
const colSize = 25;

const constantChunks = new Map();

const writeChar = (code, col, ln) => {
    const id = Math.floor(col / rowSize) + ',' + Math.floor(ln / colSize);
    col %= rowSize;
    ln %= colSize;
    if(col < 0) col += rowSize;
    if(ln < 0) ln += colSize;
    constantChunks.get(id)[ln * rowSize + col] = code;
}

const registerChunks = (x, y, width, height) => {
    const cw = x + Math.floor(width / rowSize);
    const ch = y + Math.floor(height / colSize);

    for(let cy = y; cy <= ch; ++cy) {
        for(let cx = x; cx <= cw; ++cx) {
            constantChunks.set(cx + ',' + cy, new Uint32Array(rowSize * colSize).fill(7 << 20 | 32))
        }
    }
}

const write = (str, x, y, fg = 0, bg = 7) => {
    const lines = str.split('\n').map((l, i) => (i + 1).toString().padStart(4, ' ') + '|' + l);
    const height = lines.length;
    const width = Math.max(...lines.map(l => l.length));

    registerChunks(0, 0, width, height);
    
    for(let cy = 0; cy < lines.length; ++cy) {
        for(let i = 0, cx = 0; i < lines[cy].length; ++i, ++cx) {
            switch(lines[cy][i]) {
                case '\t' :
                    cx += 1;
                    break;
                default : 
                    writeChar(lines[cy].charCodeAt(i) | (fg << 16) | (bg << 20), x + cx, y + cy);
                    break;
            }
        }
    }
}

const text = fs.readFileSync('../static/socket.mjs', {encoding: 'utf-8'});
//write(text, 0, 0, 0, 7);

export default constantChunks;