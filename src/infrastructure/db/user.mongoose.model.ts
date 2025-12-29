import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDocument extends Document {
    fullName: string;
    email: string;
    password: string;
    role: 'user' | 'admin';
    createdAt: Date;
    updatedAt: Date;

    passwordChangedAt?: Date;
    passwordResetTokenHash?: string | null;
    passwordResetExpiresAt?: Date | null;
}

const UserSchema: Schema = new Schema<IUserDocument>(
    {
        fullName: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, select: false },
        role: { type: String, enum: ['user', 'admin'], default: 'user' },

        passwordChangedAt: { type: Date },

        passwordResetTokenHash: { type: String, default: null, select: false },
        passwordResetExpiresAt: { type: Date, default: null },
    },
    { timestamps: true }
);


export default mongoose.model<IUserDocument>('User', UserSchema);
