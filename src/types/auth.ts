export type SignupData = {
    fullName: string;
    email: string;
    password: string;
    role: 'user';
};

export type ForgotPasswordResponse = {
    resetToken: string;
};
