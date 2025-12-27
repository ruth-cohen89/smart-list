export interface User {
    id: string
    fullName: string
    email: string
    password: string
    role: 'user' | 'admin'
    createdAt: Date
    updatedAt: Date
}

export type Role = 'user' | 'admin';

export type CreateUserInput = {
    fullName: string;
    email: string;
    password: string;
    role?: Role;
};

export type CreateUserData = {
    fullName: string;
    email: string;
    password: string; // hashed
    role: Role;       // required
};




