import mongoose from 'mongoose';

async function logCollectionIndexes(collectionName: string): Promise<void> {
  try {
    const collection = mongoose.connection.collection(collectionName);
    const indexes = await collection.indexes();
    console.log(
      `[DB_INDEXES] ${collectionName}: ${indexes.map((idx) => JSON.stringify(idx.key)).join(', ')}`,
    );
  } catch {
    console.log(`[DB_INDEXES] ${collectionName}: collection not found or no indexes`);
  }
}

export const connectMongo = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined');
    }

    await mongoose.connect(process.env.MONGO_URI as string);
    const { host, port, name } = mongoose.connection;
    console.log(`✅ MongoDB connected — host: ${host}:${port}, db: ${name}`);
    console.log(`[DB] mongoose.connection.name = "${name}"`);
    console.log(`[DB] mongoose.connection.host = "${host}"`);
    console.log(`[DB] mongoose.connection.port = ${port}`);

    // Temporary: verify indexes exist for performance debugging
    await logCollectionIndexes('chainproducts');
    await logCollectionIndexes('promotions');

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
