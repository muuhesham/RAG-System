import express from "express";
import {
  PORT,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
} from "./env.js";
import { chatModel } from "./ai-model.js";
import {supabaseClient} from "./db.js";
import {embedding} from "./embedding.js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { prompt } from "./prompt.js";

const app = express();
app.use(express.json());

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const embeddings = embedding();

const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});


app.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({
        message: "please provide a valid question!",
      });
    }
    const relevantDocs = await vectorStore.similaritySearch(question);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
    const messages = await prompt.invoke({ context, question });
    const response = await chatModel.invoke(messages);

    res.json({
      answer: response.content,
      sources: relevantDocs.map((doc) => doc.metadata),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong while answering the question",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
