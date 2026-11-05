import cors from 'cors';
import { FRONTEND_URL } from './env.js';

export const corsOptions = cors({
    origin: FRONTEND_URL,
    methods: ["POST", "DELETE", "GET"],
    maxAge: 3600,
});