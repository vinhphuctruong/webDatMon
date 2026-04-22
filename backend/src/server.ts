import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend started at http://localhost:${env.PORT}${env.API_PREFIX}`);
});
