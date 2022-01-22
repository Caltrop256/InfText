import Chunks from './chunks.mjs'
const chunkWidth = 50;
const chunkHeight = 25;
const defaultBackground = 0;
const defaultForeground = 15;
const rowSize = 50;
const colSize = 25;

const constantChunks = new Map();

constantChunks.set('0,0', new Uint32Array(chunkWidth * chunkHeight).fill(7 << 20 | 32));

const writeChar = (code, col, ln) => {
    const id = Math.floor(col / rowSize) + ',' + Math.floor(ln / colSize);
    col %= rowSize;
    ln %= colSize;
    if(col < 0) col += rowSize;
    if(ln < 0) ln += colSize;
    constantChunks.get(id)[ln * rowSize + col] = code;
}

const write = (str, x, y, fg = 0, bg = 7) => {
    const lines = str.split('\n');
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

write(`

An infinite canvas of text to edit and explore!
All changes you make are visible to all other
visitors in real time! bababbaabaaa
bwah bwah bwah hhhhhhh

 Navigation:               Shortcuts:
  
 ←↑→   : move caret         ctrl+c: copy
 lmouse: pan & set caret    ctrl+v: paste
 TAB   : 4 spaces           ctrl+x: cut
 Enter : next line          ctrl+z: undo
 PgUp  : screen up          ctrl+y: redo
 PgDn  : screen down        rmouse: copy colors
 ctrl+→: set caret to edge  alt+←→: undo/redo tp
 HOME  : return line        mwheel: font size

Set-up a portal to easily share your creations!
Just write down the coordinates like this

           create something pretty and have fun!
                                          ~sarah
`, 1, 1);

write('Welcome to <name>                  (11/jan/2022)', 1, 1);
write('@38,19', 43, 20, 4);
write('[source]', 1, 23, 4);

constantChunks.delete('0,0');

export default constantChunks;