import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createApp } from './server/src/app';
import { connectDB } from './server/src/config/db';

dotenv.config();

const PORT = 3000;

async function startServer() {
  // Connect to MongoDB
  await connectDB();

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
    console.log(`DocuClean AI Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
});
