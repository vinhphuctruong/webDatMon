import { createApp } from "./app";
import { env } from "./config/env";
import http from "http";
import { initSocket } from "./socket";

const app = createApp();
const server = http.createServer(app);

initSocket(server);

server.listen(env.PORT, () => {
  console.log(`Backend started at http://localhost:${env.PORT}${env.API_PREFIX}`);
});
