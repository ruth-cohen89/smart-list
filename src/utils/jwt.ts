import jwt from 'jsonwebtoken';

export type TokenClaims = {
    id: string;
    role: 'user' | 'admin';
};

export type DecodedToken = TokenClaims & {
    iat: number;
    exp: number;
};

export const generateToken = (claims: TokenClaims): string => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not defined');
    return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): Promise<DecodedToken> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded as DecodedToken);
        });
    });
};
