import mongoose, { Schema, Document } from 'mongoose'

export interface IUserDocument extends Document {
    fullName: string
    email: string
    password: string
    role: 'user' | 'admin'
    createdAt: Date
    updatedAt: Date
}

const UserSchema: Schema = new Schema<IUserDocument>(
    {
        fullName: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        role: { type: String, enum: ['user', 'admin'], default: 'user' },
    },
    { timestamps: true }
)

export default mongoose.model<IUserDocument>('User', UserSchema)
