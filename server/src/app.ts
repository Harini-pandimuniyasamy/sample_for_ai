import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import documentRoutes from './routes/documentRoutes';
import { errorHandler } from './middleware/errorMiddleware';

dotenv.config();

export const createApp = () => {
  const app = express();

  // CORS Configuration
  const clientUrl = process.env.CLIENT_URL;
  app.use(
    cors({
      origin: clientUrl && clientUrl !== '*' ? [clientUrl, 'http://localhost:5173', 'http://localhost:3000'] : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static uploads directory for development inspection if needed
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'server/uploads')));

  // API Health check
  app.get('/api/health', (_req, res) => {
    const readyState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const isConnected = readyState === 1;

    if (isConnected) {
      res.status(200).json({
        success: true,
        server: 'running',
        database: 'connected',
        databaseName: mongoose.connection.name,
        readyState: 1,
      });
    } else {
      res.status(503).json({
        success: false,
        server: 'running',
        database: 'disconnected',
        readyState,
      });
    }
  });

  // API Routes (Primary /api/*)
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/documents', documentRoutes);

  // Secondary aliases (/app/*) in case VITE_API_URL is configured as /app
  app.use('/app/auth', authRoutes);
  app.use('/app/users', userRoutes);
  app.use('/app/documents', documentRoutes);

  // Error Handler Middleware
  app.use(errorHandler);

  return app;
};

export default createApp;
