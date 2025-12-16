import jwt from 'jsonwebtoken';

export interface JwtPayload {
    id: string;
    role: 'user' | 'admin';
}

export const generateToken = (payload: JwtPayload): string => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not defined');
    }

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};
