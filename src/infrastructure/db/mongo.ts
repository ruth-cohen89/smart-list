import mongoose from 'mongoose';

export const connectMongo = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined');
    }

    await mongoose.connect(process.env.MONGO_URI as string);
    const { host, port, name } = mongoose.connection;
    console.log(`✅ MongoDB connected — host: ${host}:${port}, db: ${name}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongo error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.error('⚠️ Mongo disconnected');
    });
  } catch (error) {
    console.error('Mongo connection failed', error);
    throw error;
  }
};
