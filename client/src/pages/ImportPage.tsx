import { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, XCircle, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface ImportStats {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
}

interface EnrichmentStatus {
  pending: number;
  enriched: number;
  total: number;
}

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentStarted, setEnrichmentStarted] = useState(false);
  const [lastImportedFilename, setLastImportedFilename] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [enrichmentStatus, setEnrichmentStatus] = useState<EnrichmentStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError('');
        setStats(null);
      } else {
        setError('Please select a CSV file');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setError('');
      setStats(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError('');
    setStats(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post('/csv/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setStats(response.data.stats);
      setLastImportedFilename(selectedFile.name);
      setEnrichmentStarted(false);
      
      // Fetch enrichment status for this import
      try {
        const statusRes = await api.get(`/enrichment/status?import_source=${encodeURIComponent(selectedFile.name)}`);
        setEnrichmentStatus(statusRes.data);
      } catch {
        // Ignore status error
      }
      
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartEnrichment = async () => {
    if (!lastImportedFilename) return;
    
    setIsEnriching(true);
    try {
      await api.post('/enrichment/batch', {
        import_source: lastImportedFilename,
        limit: 100
      });
      setEnrichmentStarted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start enrichment');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/csv/template', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'north_data_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CSV Import</h1>
          <p className="text-gray-600 mt-1">Import leads from North Data CSV files</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center space-x-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          <span>Download Template</span>
        </button>
      </div>

      <div className="bg-white p-8 rounded-lg shadow max-w-3xl">
        {/* File Upload Area */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-orange-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />

          {selectedFile ? (
            <div className="space-y-4">
              <FileText className="w-16 h-16 text-primary mx-auto" />
              <div>
                <p className="text-lg font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Remove
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : 'Upload & Import'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="w-16 h-16 text-gray-400 mx-auto" />
              <div>
                <p className="text-lg text-gray-700">
                  Drag and drop your CSV file here, or{' '}
                  <label
                    htmlFor="file-upload"
                    className="text-primary hover:text-orange-600 cursor-pointer font-medium"
                  >
                    browse
                  </label>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  CSV files up to 10MB • Semicolon delimiter • Windows-1252 encoding
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start space-x-3">
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Import Failed</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Success Stats */}
        {stats && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start space-x-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900">Import Completed Successfully</p>
                <p className="text-sm text-green-700 mt-1">
                  Your CSV file has been processed and leads have been imported
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600">Total Rows</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600">Imported</p>
                <p className="text-2xl font-bold text-green-600">{stats.imported}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600">Updated</p>
                <p className="text-2xl font-bold text-blue-600">{stats.updated}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600">Skipped</p>
                <p className="text-2xl font-bold text-gray-600">{stats.skipped}</p>
              </div>
            </div>

            {/* Enrichment Section */}
            {enrichmentStatus && enrichmentStatus.pending > 0 && (
              <div className="mt-6 pt-6 border-t border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      KI-Enrichment verfügbar
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      {enrichmentStatus.pending} von {enrichmentStatus.total} Leads können angereichert werden
                    </p>
                  </div>
                  {enrichmentStarted ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Enrichment läuft im Hintergrund...</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartEnrichment}
                      disabled={isEnriching}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all"
                    >
                      {isEnriching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>{isEnriching ? 'Starte...' : 'Enrichment starten'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-2">CSV Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Use semicolon (;) as delimiter</li>
                <li>Windows-1252 encoding for German umlauts</li>
                <li>Required field: Company Name</li>
                <li>Duplicate Register-IDs will update existing leads</li>
                <li>New leads will be assigned to "Neu" stage by default</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
