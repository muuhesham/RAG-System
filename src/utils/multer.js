import multer from "multer";
import path from "node:path";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedExtensions = [".txt", ".md", ".pdf"];
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      const error = new Error(`Unsupported file type: ${extension || "unknown"}`);
      error.code = "UNSUPPORTED_FILE_TYPE";
      return callback(error);
    }

    callback(null, true);
  },
});