import { AppError } from './app-error';

export const handleDuplicateFieldsMongo = (err: any) => {
    console.log('handle')
    const value = err.keyValue ? JSON.stringify(err.keyValue) : 'duplicate value';
    return new AppError(`Duplicate field value: ${value}. Please use another value!`, 400);
};

export const handleValidationErrorMongo = (err: any) => {
    const errors = Object.values(err.errors).map((el: any) => el.message);
    return new AppError(`Invalid input data: ${errors.join('. ')}`, 400);
};
