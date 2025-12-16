// src/infrastructure/db/mongo.ts
import mongoose from 'mongoose'

export const connectMongo = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined')
        }

        await mongoose.connect(process.env.MONGO_URI as string)
        console.log('✅ MongoDB connected')
    } catch (error) {
        console.error('Mongo connection failed')
        throw error
    }
}
