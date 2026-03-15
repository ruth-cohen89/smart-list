import dotenv from 'dotenv';
import { createApp } from './app';
import { connectMongo } from './infrastructure/db/mongo';
import mongoose from 'mongoose';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.development' });
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const startServer = async () => {
  try {
    await connectMongo();
    const app = createApp();

    const server = app.listen(PORT, HOST, () => {
      console.log(`HI Server running on http://${HOST}:${PORT}`);
    });

    // graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}. Closing server...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('Server and DB connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
