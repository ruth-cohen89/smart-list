import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { receiptService } from '../../services/receiptService';
import Layout from '../../components/Layout';
import Spinner from '../../components/Spinner';

const MAX_SIZE_MB = 20;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const validate = (f: File[]): string | null => {
    if (f.length > 2) return 'You can upload up to 2 files at a time.';
    for (const file of f) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024)
        return `"${file.name}" exceeds the ${MAX_SIZE_MB} MB limit.`;
      if (!ACCEPTED.some((t) => file.type === t || file.type.startsWith('image/')))
        return `"${file.name}" is not a supported file type.`;
    }
    return null;
  };

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    const err = validate(arr);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setFiles(arr);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const receipt = await receiptService.upload(files);
      navigate(`/receipts/${receipt.receiptId}`);
    } catch (err) {
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string } } }).response;
        setError(res?.data?.message ?? 'Upload failed.');
      } else {
        setError('Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Receipt</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload a photo or PDF of your receipt. SmartList will scan it and match items
            automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
          />
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>
          <p className="text-gray-700 font-medium text-sm">
            Drag & drop or <span className="text-brand-600">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            JPG, PNG, HEIC or PDF · Max {MAX_SIZE_MB} MB · Up to 2 files
          </p>
        </div>

        {/* Selected files */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3"
              >
                <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  {file.type === 'application/pdf' ? (
                    <svg
                      className="w-5 h-5 text-brand-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-brand-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Spinner size="sm" className="text-white" />
              <span>Scanning receipt…</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l3 3 3-3m0 0V9"
                />
              </svg>
              <span>Scan & process receipt</span>
            </>
          )}
        </button>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">How it works</h3>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>Upload your receipt (photo or PDF)</li>
            <li>SmartList extracts items using OCR</li>
            <li>Items are matched against your shopping list &amp; baseline</li>
            <li>Confirm the matches to update your lists automatically</li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}
