import { Request, Response, NextFunction } from 'express';
import { handleDuplicateFieldsMongo, handleValidationErrorMongo } from './mongo-handlers';
import { handleTokenExpired, handleInvalidToken } from './auth-handlers';

export const globalErrorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  let error = err;

  // JWT library errors
  if (error.name === 'TokenExpiredError') {
    error = handleTokenExpired();
  } else if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
    error = handleInvalidToken();
  }

  // Mongo library errors
  else if (error.code === 11000) {
    error = handleDuplicateFieldsMongo(error);
  } else if (error.name === 'ValidationError') {
    error = handleValidationErrorMongo(error);
  }

  if (error.isOperational) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error('UNEXPECTED ERROR 💥', err);
  res.status(500).json({ message: 'Internal Server Error' });
};
