export interface User {
    id: string
    fullName: string
    email: string
    password: string
    passwordChangedAt?: Date
    role: 'user' | 'admin'
    createdAt: Date
    updatedAt: Date
}
