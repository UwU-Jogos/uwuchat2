//./spec.txt//
//./server.ts//

// main.ts:
// just starts a server on port 7171

import Server from './server';
const port = process.env.PORT ? parseInt(process.env.PORT) : 7171;
const server = new Server(port);
server.init();

