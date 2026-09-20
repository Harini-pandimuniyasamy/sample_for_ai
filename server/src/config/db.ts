import mongoose from 'mongoose';

let isConnected = false;
let reconnectInterval: NodeJS.Timeout | null = null;

export const connectDB = async (): Promise<boolean> => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('MongoDB Connection Error: MONGODB_URI environment variable is missing.');
    return false;
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      dbName: 'ai_document_cleaner',
    });

    isConnected = true;
    console.log('MongoDB Connected Successfully');
    console.log('Server running successfully');
    console.log(`[MongoDB Atlas] Host: ${conn.connection.host} | Database: ${conn.connection.name}`);

    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }

    return true;
  } catch (error: any) {
    isConnected = false;
    console.error('MongoDB Connection Error:', error?.message || error);

    if (
      error?.message?.includes('whitelisted') ||
      error?.message?.includes('IP') ||
      error?.message?.includes('tlsv1 alert')
    ) {
      console.error(
        '[MongoDB Atlas Action Required] Cluster access rejected your IP. Please open MongoDB Atlas -> Network Access -> Add IP Address -> Select "Allow Access from Anywhere" (0.0.0.0/0).'
      );
    }

    // Set background re-attempt so when Atlas IP whitelist updates, it connects automatically
    if (!reconnectInterval) {
      reconnectInterval = setInterval(async () => {
        if (!isConnected && process.env.MONGODB_URI) {
          try {
            await mongoose.connect(process.env.MONGODB_URI, {
              serverSelectionTimeoutMS: 5000,
              dbName: 'ai_document_cleaner',
            });
            isConnected = true;
            console.log('MongoDB Connected Successfully');
            console.log('Server running successfully');
            if (reconnectInterval) {
              clearInterval(reconnectInterval);
              reconnectInterval = null;
            }
          } catch {
            // keep waiting for whitelist
          }
        }
      }, 15000);
    }

    return false;
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('MongoDB connection lost. Reconnecting...');
});

export const isMongoConnected = () => isConnected;
