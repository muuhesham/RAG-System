import express from "express";
import { PORT } from "./config/env.js";
import chatRouter from "./api/chat.js";
import documentsRouter from "./api/documents.js";
import { corsOptions } from "./config/cors.js";
import { requireAuth } from "./middlewares/auth.js";
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
