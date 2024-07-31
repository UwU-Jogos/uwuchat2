import WebSocket from 'isomorphic-ws';
class UwUChat2Client {
    constructor() {
        this.rooms = new Map();
        this.server_time_offset = 0;
        this.best_ping = Infinity;
        this.last_ping_time = 0;
    }
    init(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.binaryType = 'arraybuffer';
            this.ws.onopen = () => {
                this.sync_time();
                resolve();
            };
            this.ws.onerror = (event) => reject(event);
            this.ws.onmessage = (event) => {
                const data = event.data;
                this.handle_message(new Uint8Array(data instanceof ArrayBuffer ? data : new ArrayBuffer(0)));
            };
        });
    }
    send(room, msg) {
        const buffer = new Uint8Array(7 + msg.length);
        buffer[0] = 2 /* MessageType.POST */;
        this.write_uint48_be(buffer, 1, room);
        buffer.set(msg, 7);
        this.ws.send(buffer);
    }
    recv(room, callback) {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
            this.join_room(room);
        }
        this.rooms.get(room).add(callback);
        return () => {
            this.rooms.get(room).delete(callback);
            if (this.rooms.get(room).size === 0) {
                this.rooms.delete(room);
                this.exit_room(room);
            }
        };
    }
    time() {
        return Date.now() + this.server_time_offset;
    }
    handle_message(data) {
        var _a;
        const tag = data[0];
        switch (tag) {
            case 3 /* MessageType.DATA */:
                const room = this.read_uint48_be(data, 1);
                const time = this.read_uint48_be(data, 7);
                const msg = data.slice(13);
                (_a = this.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.forEach(callback => callback(msg));
                break;
            case 6 /* MessageType.PONG */:
                this.handle_pong(data);
                break;
        }
    }
    join_room(room) {
        const buffer = new Uint8Array(7);
        buffer[0] = 0 /* MessageType.JOIN */;
        this.write_uint48_be(buffer, 1, room);
        this.ws.send(buffer);
    }
    exit_room(room) {
        const buffer = new Uint8Array(7);
        buffer[0] = 1 /* MessageType.EXIT */;
        this.write_uint48_be(buffer, 1, room);
        this.ws.send(buffer);
    }
    sync_time() {
        const buffer = new Uint8Array(1);
        buffer[0] = 5 /* MessageType.PING */;
        const send_time = Date.now();
        this.ws.send(buffer);
        this.last_ping_time = send_time;
    }
    handle_pong(data) {
        const receive_time = Date.now();
        const server_time = this.read_uint48_be(data, 1);
        const ping = receive_time - this.last_ping_time;
        if (ping < this.best_ping) {
            this.best_ping = ping;
            this.server_time_offset = server_time - receive_time + Math.floor(ping / 2);
        }
        setTimeout(() => this.sync_time(), 3000);
    }
    write_uint48_be(buffer, offset, value) {
        buffer[offset] = (value / Math.pow(2, 40)) & 0xFF;
        buffer[offset + 1] = (value / Math.pow(2, 32)) & 0xFF;
        buffer[offset + 2] = (value / Math.pow(2, 24)) & 0xFF;
        buffer[offset + 3] = (value / Math.pow(2, 16)) & 0xFF;
        buffer[offset + 4] = (value / Math.pow(2, 8)) & 0xFF;
        buffer[offset + 5] = value & 0xFF;
    }
    read_uint48_be(buffer, offset) {
        return (buffer[offset] * Math.pow(2, 40)) +
            (buffer[offset + 1] * Math.pow(2, 32)) +
            (buffer[offset + 2] * Math.pow(2, 24)) +
            (buffer[offset + 3] * Math.pow(2, 16)) +
            (buffer[offset + 4] * Math.pow(2, 8)) +
            buffer[offset + 5];
    }
}
export default UwUChat2Client;
