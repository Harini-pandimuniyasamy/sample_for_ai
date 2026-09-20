import { createApp } from './app';
import { connectDB } from './config/db';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function start() {
  // Connect to MongoDB
  await connectDB();

  const app = createApp();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DocuClean AI Server running on http://0.0.0.0:${PORT}`);
    console.log(`API endpoints accessible at http://0.0.0.0:${PORT}/api`);
  });
}

start().catch((err) => {
  console.error('Fatal Server Startup Error:', err);
});
