import { createClient} from "@supabase/supabase-js";

export const supabaseClient = (URL, SECRET_KEY) => {
    const supabase = createClient(URL, SECRET_KEY);
    return supabase;
} 
