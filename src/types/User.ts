export interface User {
    id: string
    fullName: string
    email: string
    password: string
    role: 'user' | 'admin'
    createdAt: Date
    updatedAt: Date
}

export type CreateUserInput = {
    fullName: string;
    email: string;
    password: string;
    role?: 'user' | 'admin';
};

export interface UpdateProfileDTO {
    fullName?: string
    email?: string
}


