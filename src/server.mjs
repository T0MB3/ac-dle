import http from "node:http";
import { handleNodeRequest } from "./lib/appHandler.mjs";

const PORT = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  handleNodeRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
