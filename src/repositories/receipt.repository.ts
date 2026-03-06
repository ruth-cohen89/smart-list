import { Types } from 'mongoose';
import ReceiptMongoose from '../infrastructure/db/receipt.mongoose.model';
import { mapReceipt } from '../mappers/receipt.mapper';

import type { Receipt, ReceiptItem } from '../models/receipt.model';

export interface CreateReceiptData {
  userId: string;
  rawText: string;
  items: ReceiptItem[];
}

export class ReceiptRepository {
  private toObjectId(id: string) {
    return new Types.ObjectId(id);
  }

  async createReceipt(data: CreateReceiptData): Promise<Receipt> {
    const doc = await ReceiptMongoose.create({
      userId: this.toObjectId(data.userId),
      uploadedAt: new Date(),
      rawText: data.rawText,
      status: 'SCANNED',
      items: data.items,
    });

    return mapReceipt(doc);
  }

  async findByIdAndUser(receiptId: string, userId: string): Promise<Receipt | null> {
    const doc = await ReceiptMongoose.findOne({
      _id: receiptId,
      userId: this.toObjectId(userId),
    });

    return doc ? mapReceipt(doc) : null;
  }
}
