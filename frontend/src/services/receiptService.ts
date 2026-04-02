import api from './api';
import type {
  Receipt,
  ReceiptItem,
  MatchItemsResponse,
  ConfirmMatchesPayload,
  ConfirmMatchesResponse,
} from '../types';

export const receiptService = {
  upload: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('file', file));
    return api
      .post<{ receiptId: string; items: ReceiptItem[] }>('/receipts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  getById: (receiptId: string) =>
    api.get<{ receipt: Receipt }>(`/receipts/${receiptId}`).then((r) => r.data.receipt),

  matchItems: (receiptId: string) =>
    api
      .post<MatchItemsResponse>(`/receipts/${receiptId}/match-items`)
      .then((r) => r.data),

  confirmMatches: (receiptId: string, payload: ConfirmMatchesPayload) =>
    api
      .post<ConfirmMatchesResponse>(
        `/receipts/${receiptId}/confirm-matches`,
        payload
      )
      .then((r) => r.data),
};
