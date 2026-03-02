import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { ReceiptController } from '../controllers/receipt.controller';
import { ReceiptService } from '../services/receipt.service';
import { ReceiptRepository } from '../repositories/receipt.repository';
import { GoogleVisionOcrProvider } from '../infrastructure/ocr/google-vision-ocr.provider';
import { authenticate } from '../middlewares/authenticate';
import { AppError } from '../errors/app-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      return cb(new AppError('PDF not supported yet', 400));
    }
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Unsupported file type', 400));
    }
    cb(null, true);
  },
});

// Wraps multer so LIMIT_FILE_SIZE becomes a proper 413 AppError.
function uploadSingle(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (multerErr) => {
    if (multerErr instanceof MulterError && multerErr.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large (max 10 MB)', 413));
    }
    next(multerErr);
  });
}

const ocrProvider = new GoogleVisionOcrProvider();
const receiptRepo = new ReceiptRepository();
const service = new ReceiptService(ocrProvider, receiptRepo);
const controller = new ReceiptController(service);

const router = Router();

router.post('/upload', authenticate, uploadSingle, controller.uploadReceipt);

export default router;
