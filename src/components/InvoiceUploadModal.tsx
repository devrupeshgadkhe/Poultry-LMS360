import React, { useState, useRef } from 'react';
import { Upload, Camera, X, RefreshCw, FileText, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  onQuotaExceeded?: () => void;
}

export const InvoiceUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  onQuotaExceeded
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMsg(null);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null); // PDF icon
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowed.includes(file.type)) {
        setErrorMsg('Unsupported format. Please drop a JPG, PNG, WEBP, or PDF invoice.');
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleStartScan = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select an invoice image or PDF document first.');
      return;
    }

    setIsScanning(true);
    setErrorMsg(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        try {
          const fullDataUrl = reader.result as string;
          const base64Data = fullDataUrl.includes(',') ? fullDataUrl.split(',')[1] : fullDataUrl;
          const mimeType = selectedFile.type || 'application/pdf';

          const res = await fetch('/api/ai/parse-invoice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({ fileBase64: base64Data, mimeType })
          });

          const data = await res.json();

          if (!res.ok) {
            if (res.status === 429 || res.status === 403) {
              onQuotaExceeded?.();
            }
            throw new Error(data.error || 'Invoice scanning failed.');
          }

          onSuccess(data.invoice || data);
        } catch (postErr: any) {
          setIsScanning(false);
          setErrorMsg(postErr.message || 'Error occurred while communicating with AI service.');
        }
      };

      reader.onerror = () => {
        setIsScanning(false);
        setErrorMsg('Failed to read the selected file. Please re-select the file.');
      };
    } catch (err: any) {
      setIsScanning(false);
      setErrorMsg(err.message || 'An unexpected error occurred during invoice scanning.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-800 tracking-tight">AI Purchase Bill Scanner</h3>
              <p className="text-[11px] text-slate-500">Multimodal OCR for handwritten receipts, GST bills & PDFs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isScanning}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Upload Zone */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-50 hover:bg-emerald-50/20 group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-3 shadow-xs group-hover:scale-105 transition">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition" />
              </div>
              <p className="text-xs font-bold text-slate-700">Click or drag bill photo or PDF here</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Supports JPG, PNG, WEBP and PDF documents (Max 50MB)
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-[10px] text-slate-500 font-medium">
                <Camera className="w-3 h-3 text-emerald-600" />
                <span>Camera photos & handwritten slips supported</span>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center gap-4">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Bill preview"
                  className="w-16 h-16 object-cover rounded-xl border border-slate-300 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-200 shrink-0">
                  <FileText className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB &bull; {selectedFile.type || 'Document'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold hover:underline mt-1 inline-block cursor-pointer"
                >
                  Change File
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 text-[11px] text-slate-600 space-y-1.5 font-sans">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Automatically extracts Supplier, Invoice No, Date & Line Items</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Supports Marathi, Hindi, and English product descriptions</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Accurate GST rate calculation & 0% tax handling on non-GST slips</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartScan}
            disabled={isScanning || !selectedFile}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/15 transition cursor-pointer"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing Invoice with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extract & Auto-Fill Bill</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
