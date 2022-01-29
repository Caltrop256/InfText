import HUD from './hud.mjs'
import Draw from './draw.mjs'
import Chunk from './chunk.mjs'
import Camera from './camera.mjs'
import C from './setup.mjs'

let ready = false;
const loadStack = [];
const exp = {
    postMessage(...args) {
        if(this.historicalMode) return;
        if(!ready) loadStack.push(args);
        else exp.worker.postMessage(...args);
    },
    totalOnline: 1,
    _connectionState: -1,
    historicalMode: location.pathname.match(/\/historical\/(\d{4,4}-\d{2,2}-\d{2,2})(.chunks)?$/)
}

if(exp.historicalMode) {
    fetch(location.pathname + '.chunks')
    .then(res => res.arrayBuffer())
    .then(buf => {
        console.log(new Uint32Array(buf));
        C.run('decodeChunkSequence', (x, y, chunkData) => {
            Draw.cache.set(x + ',' + y, Chunk.fromUint32Array(chunkData));
        }, C.allocateArray(new Uint32Array(buf)));
        Draw.updateClaimedChunks();
        Draw.needsRedraw = true;
        Camera.refuseMovement = false;
        HUD.borderFg = 15;
    })
} else {
    fetch('/gateway')
    .then(res => res.json())
    .then(info => {
        exp.worker = new Worker(URL.createObjectURL(new Blob(['(' + function() {
            let reconnectionDelay = 1000;
            let socket = null;
            let pingInterval = null;
            let connecting = true;
            let lastClaim = null;
            const heartbeat = [[HEARTBEAT]];
        
            const stack = [];
        
            self.onmessage = (msg) => {
                if(socket && !connecting) socket.send(msg.data);
                else if(!msg.data.startsWith('{"added":')) stack.push(msg.data);
            }
        
            const createSocket = (reconnection = false) => {
                socket = new WebSocket('[[CONNECTION]]');
                socket.onopen = () => {
                    connecting = false;
                    reconnectionDelay = 1000;
                    self.postMessage(reconnection ? '__reconnected' : '__ready');
                    pingInterval = setInterval(() => socket.send('{"ping": '+ Date.now()+'}'), heartbeat);
                    if(lastClaim != null) socket.send(lastClaim);
                    let m = null;
                    while(m = stack.pop()) socket.send(m);
                }
        
                socket.onmessage = msg => {
                    self.postMessage(msg.data);
                }
        
                const attemptReconnect = () => {
                    socket = null;
                    connecting = true;
                    self.postMessage('__disconnected');
                    clearInterval(pingInterval);
                    reconnectionDelay = Math.min(20 * 1000, reconnectionDelay * 1.5);
                    console.warn('Attempting to reconnect\nDelay: ' + (reconnectionDelay / 1000).toFixed(1) + 's');
                    setTimeout(createSocket, reconnectionDelay, true);
                }
            
                socket.onclose = () => {
                    if(!connecting) attemptReconnect();
                };
                socket.onerror = attemptReconnect;
            }
            createSocket(false);
        }.toString()
            .replace(/\[\[CONNECTION\]\]/, info.url)
            .replace(/\[\[HEARTBEAT\]\]/, info.heartbeat)
        + ')();'], {type: 'text/javascript'})));
    
        window.addEventListener('beforeunload', () => {
            exp.worker.onmessage = () => {};
        })
    
        while(loadStack.length) exp.worker.postMessage(...loadStack.pop());
        ready = true;
        
        exp.worker.onmessage = msg => {
            switch(msg.data) {
                case '__ready' :
                    reveal(2);
                case '__reconnected' :
                    Draw.foreignCarets.clear();
                    Draw.cache.clear();
                    Draw.claimed.clear();
                    exp._connectionState = 1;
                    Draw.updateClaimedChunks();
                    Camera.refuseMovement = false;
                    HUD.borderFg = 15;
                    return;
                case 'r' :
                    exp._connectionState = -2;
                    Camera.refuseMovement = true;
                    HUD.borderFg = 9;
                    setTimeout(() => {
                        exp._connectionState = 1;
                        Camera.refuseMovement = false;
                        HUD.borderFg = 15;
                        Draw.needsRedraw = true;
                    }, 1000 * 10);
                    return;
                case '__disconnected' :
                    exp._connectionState = 0;
                    Camera.refuseMovement = true;
                    HUD.borderFg = 9;
                    return;
            }
            
            if(msg.data instanceof Blob) {
                msg.data.arrayBuffer().then(buf => {
                    C.run('decodeChunkSequence', (x, y, chunkData) => {
                        Draw.cache.set(x + ',' + y, Chunk.fromUint32Array(chunkData));
                    }, C.allocateArray(new Uint32Array(buf)));
                    Draw.needsRedraw = true;
                });
            } else {
                const data = JSON.parse(msg.data);
        
                if(typeof data.online == 'number') exp.totalOnline = data.online;
                if(Array.isArray(data.patch)) {
                    for(const info of data.patch) {
                        const chunk = Draw.cache.get(info.id);
                        if(!chunk) continue;
                        if(chunk.lines[info.ln][info.col] == info.code) continue;
                        chunk.imageData = null;
                        chunk.lines[info.ln][info.col] = info.code
                    }
                    Draw.needsRedraw = true;
                }
        
                else if(data.ln == null) {
                    if(!Draw.foreignCarets.has(data.id)) return;
                    const caret = Draw.foreignCarets.get(data.id);
                    Draw.drawCaret(caret.col, caret.ln, true);
                    Draw.foreignCarets.delete(data.id);
                } else if(Draw.foreignCarets.has(data.id)) {
                    const caret = Draw.foreignCarets.get(data.id);
                    caret.prevCol = caret.col;
                    caret.prevLn = caret.ln;
                    caret.col = data.col;
                    caret.ln = data.ln;
                    caret.blinkInd = 0;
                } else Draw.foreignCarets.set(data.id, {col: data.col, ln: data.ln, blinkInd: 0});
            }
        }
    });
}
reveal(1);
export default exp;