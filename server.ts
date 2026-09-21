import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './server/src/app';
import { connectDB } from './server/src/config/db';

dotenv.config();

const PORT = 3000;

async function startServer() {
  console.log('Loading environment variables...');
  const mongoUriExists = Boolean(process.env.MONGODB_URI);
  console.log(`MONGODB_URI detected: ${mongoUriExists ? 'YES' : 'NO'}`);

  if (!mongoUriExists) {
    console.error('MongoDB connection failed: MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB Atlas...');
    await connectDB();

    console.log('MongoDB Connected Successfully');
    console.log(`Database: ${mongoose.connection.name}`);

    const app = createApp();

    // Vite middleware for development vs static build for production
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          host: '0.0.0.0',
          port: PORT,
          allowedHosts: true,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

startServer();
