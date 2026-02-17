import dotenv from 'dotenv';
import { createApp } from './app';
import { connectMongo } from './infrastructure/db/mongo';

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config({ path: '.env.development' });
}

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    await connectMongo();
    const app = createApp();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
