import HUD from './hud.mjs'
import Draw from './draw.mjs'
import Chunk from './chunk.mjs'
import Camera from './camera.mjs'

let ready = false;
const loadStack = [];
const exp = {
    postMessage(...args) {
        if(!ready) loadStack.push(args);
        else exp.worker.postMessage(...args);
    },
    totalOnline: 1,
    _connectionState: -1
}

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
            case '__disconnected' :
                exp._connectionState = 0;
                Camera.refuseMovement = true;
                HUD.borderFg = 9;
                return;
        }
        
        if(msg.data instanceof Blob) {
            msg.data.arrayBuffer().then(buf => {
                const u32 = new Uint32Array(buf);
                const chunkLen = Chunk.rowSize * Chunk.colSize;
                let i = 0;
                const getI64 = () => (BigInt(u32[i++]) | ((BigInt(u32[i++])) << 32n)) - 9223372036854775808n;
                while(i < u32.length) {
                    const x = getI64();
                    const y = getI64();
                    const chunkData = new Uint32Array(chunkLen);
                    if(!u32[i] && !u32[i + 1]) {
                        let j = chunkLen;
                        while(j --> 0) chunkData[j] = Chunk.blank;
                        i += 2;
                    } else {
                        let j = 0;
                        while(j < chunkLen) {
                            let k = (u32[i] >>> 24) + 1;
                            const val = u32[i++] &= 0xffffff;
                            while(k --> 0) chunkData[j++] = val;
                        }
                    }
                    const id = x + ',' + y;
                    Draw.cache.set(id, Chunk.fromUint32Array(chunkData));
                }
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
reveal(1);
export default exp;