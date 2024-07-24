# UwUChat2

UwUChat2 is a real-time gaming network library implemented in Node.js using raw WebSockets. It provides a simple API for creating chat rooms and sending/receiving messages in real-time.

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/UwU-Jogos/uwuchat2.git
   cd uwuchat2
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

## Running the Server

To start the server:

```
npm start
```

The server will start on port 8080 by default.

## Running the Client

Open the `index.html` file in a web browser to run the client.

## Project Structure

- src/
  - client.ts: Client-side implementation
  - server.ts: Server-side implementation
- dist/: Contains compiled JavaScript files (generated)
- webpack.config.js: Webpack configuration for client-side bundling
- tsconfig.json: TypeScript compiler configuration
- package.json: Project metadata and dependencies

## Usage

### Server

```javascript
const Server = require('./dist/server');

const server = new Server();
server.init(8080);
```

### Client

```javascript
const client = new UwUChat2Client();
client.init('ws://localhost:8080').then(() => {
  // Connected to server
  client.send(1, new TextEncoder().encode('Hello, World!'));

  client.recv(1, (msg) => {
    console.log('Received:', new TextDecoder().decode(msg));
  });
});
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
