import express from "express";
import { PORT } from "./utils/env.js";
import chatRouter from "./routes/chat.js";
import documentsRouter from "./routes/documents.js";

const app = express();

app.use(express.json());
app.use("/documents", documentsRouter);
app.use("/chat", chatRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
