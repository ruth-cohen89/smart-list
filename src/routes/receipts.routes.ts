import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { ReceiptController } from '../controllers/receipt.controller';
import { ReceiptService } from '../services/receipt.service';
import { ReceiptMatchService } from '../services/receipt-match.service';
import { ReceiptRepository } from '../repositories/receipt.repository';
import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ConsumptionProfileRepository } from '../repositories/consumption-profile.repository';
import { GoogleVisionOcrProvider } from '../infrastructure/ocr/google-vision-ocr.provider';
import { authenticate } from '../middlewares/authenticate';
import { validateObjectId } from '../middlewares/validate-object-id';
import { AppError } from '../errors/app-error';

const upload = multer({
  storage: multer.memoryStorage(),
  // PDFs can embed fonts and images — allow up to 20 MB. Images keep the 20 MB cap too.
  limits: { files: 2, fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf || file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new AppError('Unsupported file type — upload an image or PDF', 400));
  },
});

function uploadFiles(req: Request, res: Response, next: NextFunction): void {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'files', maxCount: 2 },
  ])(req, res, (multerErr) => {
    if (multerErr instanceof MulterError) {
      switch (multerErr.code) {
        case 'LIMIT_FILE_SIZE':
          return next(new AppError('File too large (max 20 MB per file)', 413));
        case 'LIMIT_FILE_COUNT':
          return next(new AppError('Too many files — upload at most 2 files', 400));
        case 'LIMIT_UNEXPECTED_FILE':
          return next(new AppError('Unexpected field — use field name "file" or "files"', 400));
        default:
          return next(new AppError('File upload error', 400));
      }
    }
    next(multerErr);
  });
}

const ocrProvider = new GoogleVisionOcrProvider();
const receiptRepo = new ReceiptRepository();
const shoppingListRepo = new ShoppingListRepository();
const consumptionRepo = new ConsumptionProfileRepository();
const service = new ReceiptService(ocrProvider, receiptRepo);
const matchService = new ReceiptMatchService(receiptRepo, shoppingListRepo, consumptionRepo);
const controller = new ReceiptController(service, matchService);

const router = Router();

router.post('/upload', authenticate, uploadFiles, controller.uploadReceipt);
router.post('/:receiptId/match-items', authenticate, validateObjectId('receiptId'), controller.matchItems);

export default router;
