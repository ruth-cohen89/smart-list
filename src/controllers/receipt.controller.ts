import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { catchAsync } from '../middlewares/catch-async';
import type { ReceiptService } from '../services/receipt.service';
import type { ReceiptMatchService } from '../services/receipt-match.service';

function getUserId(req: Request): string {
  if (!req.user) throw new AppError('Not authenticated', 401);
  return req.user.id;
}

export class ReceiptController {
  constructor(
    private readonly service: ReceiptService,
    private readonly matchService: ReceiptMatchService,
  ) {}

  uploadReceipt = catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);

    const fieldMap = req.files as Record<string, Express.Multer.File[]> | undefined;
    const uploadedFiles = [
      ...(fieldMap?.['file'] ?? []),
      ...(fieldMap?.['files'] ?? []),
    ];
    if (uploadedFiles.length === 0) throw new AppError('At least one image is required', 400);

    const result = await this.service.uploadReceipt(userId, uploadedFiles);

    res.status(201).json(result);
  });

  matchItems = catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { receiptId } = req.params;

    const result = await this.matchService.matchReceiptItems(userId, receiptId);

    res.status(200).json(result);
  });
}
