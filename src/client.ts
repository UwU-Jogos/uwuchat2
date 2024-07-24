//./spec.txt//
//./server.ts//

// Let's now create the uwuchat2/client.ts file. Do it below. Comment everything.
// Optimize this for in-browser client usage. Use the 'ws' library from npm, and
// Uint8Array instead of Node.js's buffer, for example. remember to always use
// underscore_case, never CamelCase, for your variables, except for types.

// uwuchat2/client.ts:

// Import WebSocket for browser environments
import WebSocket from 'isomorphic-ws';

// Define types
type Room = number;
type Recv = (msg: Uint8Array) => void;
type Exit = () => void;

// Define message types
const enum message_type {
  JOIN = 0,
  EXIT = 1,
  POST = 2,
  DATA = 3,
  TIME = 4,
  PING = 5,
  PONG = 6,
}

// UwUChat2 Client class
class UwUChat2Client {
  private ws: WebSocket;
  private rooms: Map<Room, Set<Recv>>;
  private server_time_offset: number;
  private best_ping: number;
  private last_ping_time: number;

  constructor() {
    this.rooms = new Map();
    this.server_time_offset = 0;
    this.best_ping = Infinity;
  }

  // Initialize the connection to the server
  public init(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';
      this.ws.onopen = () => {
        this.sync_time();
        resolve();
      };
      this.ws.onerror = (error) => reject(error);
      this.ws.onmessage = (event) => this.handle_message(new Uint8Array(event.data as ArrayBuffer));
    });
  }

  // Send a message to a specific room
  public send(room: Room, msg: Uint8Array): void {
    const buffer = new Uint8Array(7 + msg.length);
    buffer[0] = message_type.POST;
    this.write_uint48_be(buffer, 1, room);
    buffer.set(msg, 7);
    this.ws.send(buffer);
  }

  // Receive messages from a specific room
  public recv(room: Room, callback: Recv): Exit {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
      this.join_room(room);
    }
    this.rooms.get(room)!.add(callback);

    return () => {
      this.rooms.get(room)!.delete(callback);
      if (this.rooms.get(room)!.size === 0) {
        this.rooms.delete(room);
        this.exit_room(room);
      }
    };
  }

  // Get the current server time
  public time(): number {
    return Date.now() + this.server_time_offset;
  }

  // Handle incoming messages
  private handle_message(data: Uint8Array): void {
    const tag = data[0];
    switch (tag) {
      case message_type.DATA:
        const room = this.read_uint48_be(data, 1);
        const time = this.read_uint48_be(data, 7);
        const msg = data.slice(13);
        this.rooms.get(room)?.forEach(callback => callback(msg));
        break;
      case message_type.PONG:
        this.handle_pong(data);
        break;
    }
  }

  // Join a room
  private join_room(room: Room): void {
    const buffer = new Uint8Array(7);
    buffer[0] = message_type.JOIN;
    this.write_uint48_be(buffer, 1, room);
    this.ws.send(buffer);
  }

  // Exit a room
  private exit_room(room: Room): void {
    const buffer = new Uint8Array(7);
    buffer[0] = message_type.EXIT;
    this.write_uint48_be(buffer, 1, room);
    this.ws.send(buffer);
  }

  // Synchronize time with the server
  private sync_time(): void {
    const buffer = new Uint8Array(1);
    buffer[0] = message_type.PING;
    const send_time = Date.now();
    this.ws.send(buffer);
    this.last_ping_time = send_time;
  }

  // Handle PONG message for time synchronization
  private handle_pong(data: Uint8Array): void {
    const receive_time = Date.now();
    const server_time = this.read_uint48_be(data, 1);
    const ping = receive_time - this.last_ping_time;
    if (ping < this.best_ping) {
      this.best_ping = ping;
      this.server_time_offset = server_time - receive_time + Math.floor(ping / 2);
    }
    setTimeout(() => this.sync_time(), 3000);
  }

  // Helper function to write a 48-bit unsigned integer in big-endian format
  private write_uint48_be(buffer: Uint8Array, offset: number, value: number): void {
    buffer[offset] = (value / 2 ** 40) & 0xFF;
    buffer[offset + 1] = (value / 2 ** 32) & 0xFF;
    buffer[offset + 2] = (value / 2 ** 24) & 0xFF;
    buffer[offset + 3] = (value / 2 ** 16) & 0xFF;
    buffer[offset + 4] = (value / 2 ** 8) & 0xFF;
    buffer[offset + 5] = value & 0xFF;
  }

  // Helper function to read a 48-bit unsigned integer in big-endian format
  private read_uint48_be(buffer: Uint8Array, offset: number): number {
    return (buffer[offset] * 2 ** 40) +
           (buffer[offset + 1] * 2 ** 32) +
           (buffer[offset + 2] * 2 ** 24) +
           (buffer[offset + 3] * 2 ** 16) +
           (buffer[offset + 4] * 2 ** 8) +
           buffer[offset + 5];
  }
}

export default UwUChat2Client;
