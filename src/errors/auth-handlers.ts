import { AppError } from './app-error';

export const handleNotLoggedIn = () =>
  new AppError('You are not logged in! Please log in to get access.', 401);

export const handleUserNotFound = () =>
  new AppError('The user belonging to this token does no longer exist.', 401);

export const handlePasswordChanged = () =>
  new AppError('User recently changed password! Please log in again.', 401);

export const handleInvalidCredentials = () => new AppError('Incorrect email or password.', 401);

export const handleUnauthorizedRole = () =>
  new AppError('You do not have permission to perform this action.', 403);

export const handleTokenExpired = () => new AppError('Token expired. Please log in again.', 401);

export const handleInvalidToken = () => new AppError('Invalid token. Please log in again.', 401);
