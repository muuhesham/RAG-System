import express from "express";
import { PORT } from "./utils/env.js";
import chatRouter from "./controllers/chat.js";
import documentsRouter from "./controllers/documents.js";
import { corsOptions } from "./utils/cors.js";
import { requireAuth } from "./utils/auth.js";
import Logger from "./logs/logs.js";

const app = express();

app.use(corsOptions);
app.use(express.json());
app.use(Logger);
app.use("/documents", requireAuth, documentsRouter);
app.use("/chat", requireAuth, chatRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
