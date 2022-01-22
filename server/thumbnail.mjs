import Canvas from 'canvas'
import Chunks from './chunks.mjs'

const exp = {};

const canvas = Canvas.createCanvas(720, 540);
const ctx = canvas.getContext('2d');

const colors = [
    '#000000',
    '#800000',
    '#008000',
    '#808000',
    '#000080',
    '#800080',
    '#008080',
    '#c0c0c0',
    '#808080',
    '#ff0000',
    '#00ff00',
    '#ffff00',
    '#0000ff',
    '#ff00ff',
    '#00ffff',
    '#ffffff'
]
exp.colors = colors;

const unitHeight = 16 + 2;
const unitWidth = Math.floor(unitHeight * 0.6);
const blankCode = ' '.charCodeAt(0) | (Chunks.defaultBackground << 20) | (Chunks.defaultForeground << 16);

const letterCanvas = Canvas.createCanvas(unitWidth, unitHeight);
const lctx = letterCanvas.getContext('2d');
lctx.font = '16px "Courier New",monospace,Courier';
lctx.textBaseline = 'top';
const letterTable = new Map();
const letter = code => {
    if(letterTable.has(code)) return letterTable.get(code);
    lctx.fillStyle = colors[code >> 20];
    lctx.fillRect(0, 0, unitWidth, unitHeight);
    lctx.fillStyle = colors[code >> 16 & 0xf];
    lctx.fillText(String.fromCharCode(code & 0xffff), 0, 1, unitWidth);
    const data = lctx.getImageData(0, 0, unitWidth, unitHeight);
    letterTable.set(code, data);
    return data;
}

exp.getThumbnail = (x, y) => new Promise((resolve, reject) => {
    const cw = Chunks.chunkWidth * unitWidth;
    const ch = Chunks.chunkHeight * unitHeight;

    const cameraX = x * unitWidth - Math.floor(canvas.width / 2);
    const cameraY = y * unitHeight - Math.floor(canvas.height / 2);

    const cax = Math.floor(cameraX / cw) - 1;
    const cay = Math.floor(cameraY / ch) - 1;
    const cvpx = Math.ceil(canvas.width / cw) + cax + 2;
    const cvpy = Math.ceil(canvas.height / ch) + cay + 2;

    const request = [];
    for(let cy = cay; cy < cvpy; ++cy) {
        for(let cx = cax; cx < cvpx; ++cx) {
            request.push(cx + ',' + cy);
        }
    }
    
    Chunks.getChunks(request).then(chunks => {
        ctx.fillStyle = colors[Chunks.defaultBackground];
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for(const chunk of chunks) {
            const [cx, cy] = chunk.id.split(',').map(Number);
            const px = cx * cw - cameraX;
            const py = cy * ch - cameraY;
            
            for(let ty = 0, i = 0; ty < Chunks.chunkHeight; ++ty) {
                for(let tx = 0; tx < Chunks.chunkWidth; ++tx) {
                    const code = chunk.chunk[i++];
                    if(!code || code == blankCode) continue;
                    ctx.putImageData(letter(code), px + tx * unitWidth, py + ty * unitHeight);
                }
            }
        }
        resolve(canvas.toBuffer('image/png'));
        if(letterTable.size >= 100) letterTable.clear();
    }).catch(reject);
})


export default exp;