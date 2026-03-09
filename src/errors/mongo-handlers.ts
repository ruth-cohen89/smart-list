import { AppError } from './app-error';

interface MongoDuplicateError {
  keyValue?: Record<string, unknown>;
}

interface MongoValidationError {
  errors: Record<string, { message: string }>;
}

export const handleDuplicateFieldsMongo = (err: MongoDuplicateError) => {
  console.log('handle');
  const value = err.keyValue ? JSON.stringify(err.keyValue) : 'duplicate value';
  return new AppError(`Duplicate field value: ${value}. Please use another value!`, 400);
};

export const handleValidationErrorMongo = (err: MongoValidationError) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Invalid input data: ${errors.join('. ')}`, 400);
};
