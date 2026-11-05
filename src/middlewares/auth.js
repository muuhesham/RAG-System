import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "../config/env.js";
import { supabaseClient } from "../config/db.js";

const supabase = supabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

export async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  try {
    const { data, error } = await supabase.auth.getUser(match[1]);
    if (error || !data.user) {
      return res.status(401).json({
        message:
          "Your session has expired. Signing out now; please sign in again.",
      });
    }

    req.user = data.user;
    req.accessToken = match[1];
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Authentication could not be verified." });
  }
}
