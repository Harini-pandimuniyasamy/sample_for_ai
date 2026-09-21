import mongoose from 'mongoose';

/**
 * Global flags & connection event handlers
 */
let isEventListenersBound = false;

function bindConnectionEvents() {
  if (isEventListenersBound) return;
  isEventListenersBound = true;

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connection established');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection disconnected');
  });
}

/**
 * Connect to MongoDB Atlas
 * - Uses existing MONGODB_URI environment variable
 * - Connects only once
 * - Reuses the same connection throughout the application lifecycle
 * - Waits for full connection resolution before resolving
 */
export const connectDB = async (): Promise<typeof mongoose> => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    const errorMsg = 'MONGODB_URI environment variable is missing. Please configure it in your environment settings.';
    console.error(`MongoDB Connection Error: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Bind event listeners once
  bindConnectionEvents();

  // If already connected, reuse existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If connecting, wait for connection to complete
  if (mongoose.connection.readyState === 2) {
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose));
      mongoose.connection.once('error', (err) => reject(err));
    });
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      dbName: 'ai_document_cleaner',
      serverSelectionTimeoutMS: 8000,
    });

    return conn;
  } catch (error: any) {
    console.error('MongoDB connection failed:', error?.message || error);
    throw error;
  }
};

/**
 * Returns whether MongoDB connection is currently established (readyState === 1)
 */
export const isMongoConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

/**
 * Returns human-readable state
 */
export const getMongoConnectionState = (): { readyState: number; status: string; dbName: string } => {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const state = mongoose.connection.readyState;
  return {
    readyState: state,
    status: states[state] || 'unknown',
    dbName: mongoose.connection.name || '',
  };
};

export default connectDB;
