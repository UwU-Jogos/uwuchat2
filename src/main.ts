//./spec.txt//
//./server.ts//

// main.ts:
// just starts a server on port 8080

import Server from './server';

const server = new Server();
server.init(8080);
