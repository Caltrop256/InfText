import mysql from 'mysql';
import fs from 'fs';
import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', {encoding: 'utf-8'}));
const con = mysql.createConnection(config.mysql.analytics);

const exp = {
    isIPv4(str) {
        return /^(?:(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])\.){3}(?:\d|[1-9]\d|1\d{2}|2[0-4]\d|25[0-5])$/.test(str);
    },
    
    isIPv6(str) {
        return /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i.test(str);
    },

    extractIP(req) {
        const isValid = s => this.isIPv4(s) || this.isIPv6(s);
        const headers = ['x-client-ip', 'cf-connecting-ip', 'fastly-client-ip', 'true-client-ip', 'x-real-ip', 'x-cluster-client-ip', 'x-forwarded', 'forwarded-for', 'forwarded'];
        for(let i = 0; i < headers.length; ++i) {
            if(isValid(req.headers[headers[i]])) return req.headers[headers[i]];
        }
        const forwarded = req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',').map(e => {
            const ip = e.trim();
            if(ip.includes(':')) {
                const split = ip.split(':');
                if(split.length == 2) return split[0];
            } else return ip;
        }).find(isValid);
        if(forwarded) return forwarded;
    
        if(req.connection) {
            if(isValid(req.connection.remoteAddress)) return req.connection.remoteAddress;
            if(req.connection.socket && isValid(req.connection.socket.remoteAddress)) return req.connection.socket.remoteAddress;
        }
        if(req.socket && isValid(req.socket.remoteAddress)) return req.socket.remoteAddress;
        if(req.info && isValid(req.info.remoteAddress)) return req.info.remoteAddress;
        if(req.requestContext && req.requestContext.identity && isValid(req.requestContext.identity.sourceIp)) return req.requestContext.identity.sourceIp;
        return null;
    }
};

exp.insert = req => {
    const doNotTrack = typeof req.headers['dnt'] != 'undefined' && req.headers['dnt'] == '1';
    const startTimestamp = Date.now();
    const id = crypto.randomBytes(32).toString('base64');
    const ip = doNotTrack ? 'DNT' : exp.extractIP(req);
    const domain = config.domain;
    const location = req.url.includes('/thumbnail') ? '/thumbnail' : req.url;
    const userAgent = String(req.headers['user-agent']).substring(0, 512) || null;
    const referer = req.headers.referrer || req.headers.referer || null;
    const method = 'GET';
    const sessionLength = null;

    con.query(
        'INSERT INTO `analytics` (`id`, `timestamp`, `ip`, `domain`, `location`, `userAgent`, `referer`, `method`, `sessionLength`) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, new Date(startTimestamp), ip, domain, location, userAgent, referer, method, sessionLength],
        (err, res) => {
            if(err) console.error(err);
        }
    )
}

export default exp;