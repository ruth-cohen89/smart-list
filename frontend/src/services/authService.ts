import api from './api';
import type {
  AuthResponse,
  SignupPayload,
  LoginPayload,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  ResetPasswordPayload,
  ChangePasswordPayload,
  User,
} from '../types';

export const authService = {
  signup: (payload: SignupPayload) =>
    api.post<AuthResponse>('/auth/signup', payload).then((r) => r.data),

  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),

  forgotPassword: (payload: ForgotPasswordPayload) =>
    api.post<ForgotPasswordResponse>('/auth/forgot-password', payload).then((r) => r.data),

  resetPassword: (payload: ResetPasswordPayload) =>
    api.post<{ token: string }>('/auth/reset-password', payload).then((r) => r.data),

  changePassword: (payload: ChangePasswordPayload) =>
    api.patch<{ token: string }>('/auth/change-password', payload).then((r) => r.data),

  getMe: () => api.get<User>('/users/me').then((r) => r.data),

  updateMe: (payload: { fullName?: string; email?: string }) =>
    api.patch<User>('/users/me', payload).then((r) => r.data),

  deleteMe: () => api.delete('/users/me'),
};
