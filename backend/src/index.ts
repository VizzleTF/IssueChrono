import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { gitlabRouter } from './routes/gitlab';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// CORS configuration
app.use(cors({
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'PRIVATE-TOKEN', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: false // Disable credentials for now
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(express.json());

// Routes
app.use('/api/gitlab', gitlabRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global error handler:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
    console.log(`CORS enabled for all origins (development mode)`);
}); 