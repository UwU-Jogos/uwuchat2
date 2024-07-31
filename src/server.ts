import WebSocket from 'ws';
import { Buffer } from 'buffer';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

type Room = number;
type Time = number;
type Data = Buffer;
type Post = { data: Data; time: Time };

type ServerState = {
  rooms: Map<Room, {
    clients: Set<WebSocket>;
    messages: Post[];
  }>;
}

const enum MessageType {
  JOIN = 0,
  EXIT = 1,
  POST = 2,
  DATA = 3,
  TIME = 4,
  PING = 5,
  PONG = 6,
}

export class UwUChat2Server {
  private state: ServerState;
  private server: http.Server;
  private wss: WebSocket.Server;

  constructor() {
    this.state = { rooms: new Map() };
    this.server = http.createServer();
    this.wss = new WebSocket.Server({ server: this.server });
  }

  public init(port: number = 7171): void {
    this.load_persisted_data();
    this.wss.on('connection', this.handle_connection.bind(this));
    this.server.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
    });
  }

  private handle_connection(ws: WebSocket): void {
    ws.on('message', (message: Buffer) => this.handle_message(ws, message));
    ws.on('close', () => this.handle_disconnect(ws));
  }

  private handle_message(ws: WebSocket, message: Buffer): void {
    const tag = message.readUInt8(0);
    switch (tag) {
      case MessageType.JOIN:
      case MessageType.EXIT:
      case MessageType.POST:
        const room = message.readUIntBE(1, 6);
        if (tag === MessageType.JOIN) this.handle_join(ws, room);
        else if (tag === MessageType.EXIT) this.handle_exit(ws, room);
        else this.handle_post(room, message.slice(7));
        break;
      case MessageType.PING:
        this.handle_ping(ws);
        break;
    }
  }

  private handle_disconnect(ws: WebSocket): void {
    this.state.rooms.forEach(room_data => room_data.clients.delete(ws));
  }

  private handle_join(ws: WebSocket, room: Room): void {
    let room_data = this.state.rooms.get(room);
    if (!room_data) {
      room_data = { clients: new Set<WebSocket>(), messages: [] as Post[] };
      this.state.rooms.set(room, room_data);
    }
    room_data.clients.add(ws);

    const buffer = Buffer.allocUnsafe(13);
    buffer.writeUInt8(MessageType.DATA, 0);
    buffer.writeUIntBE(room, 1, 6);
    for (const post of room_data.messages) {
      buffer.writeUIntBE(post.time, 7, 6);
      ws.send(Buffer.concat([buffer, post.data]));
    }
  }

  private handle_exit(ws: WebSocket, room: Room): void {
    this.state.rooms.get(room)?.clients.delete(ws);
  }

  private handle_post(room: Room, data: Buffer): void {
    const time = Date.now();
    const post: Post = { data, time };

    let room_data = this.state.rooms.get(room);
    if (!room_data) {
      room_data = { clients: new Set<WebSocket>(), messages: [] as Post[] };
      this.state.rooms.set(room, room_data);
    }
    room_data.messages.push(post);

    const buffer = Buffer.allocUnsafe(13);
    buffer.writeUInt8(MessageType.DATA, 0);
    buffer.writeUIntBE(room, 1, 6);
    buffer.writeUIntBE(time, 7, 6);
    const message = Buffer.concat([buffer, data]);

    room_data.clients.forEach(client => client.send(message));

    this.persist_message(room, post);
  }

  private handle_ping(ws: WebSocket): void {
    const buffer = Buffer.allocUnsafe(7);
    buffer.writeUInt8(MessageType.PONG, 0);
    buffer.writeUIntBE(Date.now(), 1, 6);
    ws.send(buffer);
  }

  private persist_message(room: Room, post: Post): void {
    const room_file = path.join('data', room.toString(16).padStart(12, '0'));
    const buffer = Buffer.allocUnsafe(10 + post.data.length);
    buffer.writeUIntBE(post.time, 0, 6);
    buffer.writeUInt32BE(post.data.length, 6);
    post.data.copy(buffer, 10);
    fs.appendFile(room_file, buffer, (err) => {
      if (err) console.error('Error persisting message:', err);
    });
  }

  private load_persisted_data(): void {
    const data_dir = 'data';
    if (!fs.existsSync(data_dir)) {
      fs.mkdirSync(data_dir);
      return;
    }

    fs.readdirSync(data_dir).forEach(file => {
      const room = parseInt(file, 16);
      const room_data = { clients: new Set<WebSocket>(), messages: [] as Post[] };
      this.state.rooms.set(room, room_data);

      const file_path = path.join(data_dir, file);
      const file_content = fs.readFileSync(file_path);
      let offset = 0;
      while (offset < file_content.length) {
        const time = file_content.readUIntBE(offset, 6);
        offset += 6;
        const data_length = file_content.readUInt32BE(offset);
        offset += 4;
        const data = file_content.slice(offset, offset + data_length);
        offset += data_length;
        room_data.messages.push({ time, data });
      }
    });
  }
}
