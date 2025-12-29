export type SignupInput = {
    fullName: string;
    email: string;
    password: string;
};

export type SignupData = {
    fullName: string;
    email: string;
    password: string; // hashed
    role: 'user';
};

export type LoginInput = {
    email: string;
    password: string;
};

export type ChangePasswordInput = {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
};

export type ForgotPasswordInput = {
    email: string;
};

export type ForgotPasswordResponse = {
    resetToken: string;
};

export type ResetPasswordInput = {
    token: string;
    newPassword: string;
    confirmPassword: string;
};
