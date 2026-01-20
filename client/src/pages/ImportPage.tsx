import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, FileText, CheckCircle, XCircle, AlertCircle, Sparkles, Loader2, Clock, Database } from 'lucide-react';
import api from '@/lib/api';

interface ImportStats {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
}

interface ImportHistoryItem {
  name: string;
  total: number;
  enriched: number;
  pending: number;
  firstImport: string;
  lastImport: string;
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
  const [enrichingSource, setEnrichingSource] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<ImportStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch import history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['importHistory'],
    queryFn: async () => {
      const response = await api.get('/csv/history');
      return response.data.imports as ImportHistoryItem[];
    },
  });

  // Fetch global enrichment status
  const { data: globalStatus } = useQuery({
    queryKey: ['enrichmentStatus'],
    queryFn: async () => {
      const response = await api.get('/enrichment/status');
      return response.data as EnrichmentStatus;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

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
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh history and status
      queryClient.invalidateQueries({ queryKey: ['importHistory'] });
      queryClient.invalidateQueries({ queryKey: ['enrichmentStatus'] });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartEnrichment = async (importSource?: string) => {
    setEnrichingSource(importSource || 'all');
    try {
      await api.post('/enrichment/batch', {
        import_source: importSource,
        limit: 100
      });
      // Refresh after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['importHistory'] });
        queryClient.invalidateQueries({ queryKey: ['enrichmentStatus'] });
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start enrichment');
    } finally {
      setTimeout(() => setEnrichingSource(null), 3000);
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

  const totalPending = globalStatus?.pending || 0;

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

      {/* Global Enrichment Status Banner */}
      {totalPending > 0 && (
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-purple-900">
                  {totalPending} Datensätze müssen noch enriched werden
                </p>
                <p className="text-sm text-purple-700">
                  {globalStatus?.enriched || 0} von {globalStatus?.total || 0} Leads bereits angereichert
                </p>
              </div>
            </div>
            <button
              onClick={() => handleStartEnrichment()}
              disabled={enrichingSource === 'all'}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {enrichingSource === 'all' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{enrichingSource === 'all' ? 'Läuft...' : 'Alle enrichen'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Neue Datei importieren
          </h2>

          {/* File Upload Area */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
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
                <FileText className="w-12 h-12 text-primary mx-auto" />
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
                    <span>{isUploading ? 'Uploading...' : 'Import'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-gray-700">
                    Drag & drop oder{' '}
                    <label
                      htmlFor="file-upload"
                      className="text-primary hover:text-orange-600 cursor-pointer font-medium"
                    >
                      durchsuchen
                    </label>
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    CSV bis 10MB • Semikolon-Trennung
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start space-x-3">
              <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Stats */}
          {stats && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-900">Import erfolgreich!</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white rounded p-2">
                  <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-600">Gesamt</p>
                </div>
                <div className="bg-white rounded p-2">
                  <p className="text-lg font-bold text-green-600">{stats.imported}</p>
                  <p className="text-xs text-gray-600">Neu</p>
                </div>
                <div className="bg-white rounded p-2">
                  <p className="text-lg font-bold text-blue-600">{stats.updated}</p>
                  <p className="text-xs text-gray-600">Updated</p>
                </div>
                <div className="bg-white rounded p-2">
                  <p className="text-lg font-bold text-gray-500">{stats.skipped}</p>
                  <p className="text-xs text-gray-600">Übersprungen</p>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Format-Anforderungen:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Semikolon (;) als Trennzeichen</li>
                  <li>Windows-1252 Encoding für Umlaute</li>
                  <li>Pflichtfeld: Name</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Import History Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Import History
          </h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : historyData && historyData.length > 0 ? (
            <div className="space-y-3">
              {historyData.map((item) => (
                <div
                  key={item.name}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.lastImport).toLocaleDateString('de-DE')}
                        </span>
                        <span>{item.total} Leads</span>
                      </div>
                    </div>
                    
                    {item.pending > 0 && (
                      <button
                        onClick={() => handleStartEnrichment(item.name)}
                        disabled={enrichingSource === item.name}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors"
                      >
                        {enrichingSource === item.name ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{item.pending} enrichen</span>
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Enrichment-Fortschritt</span>
                      <span>{item.enriched}/{item.total}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                        style={{ width: `${(item.enriched / item.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Noch keine Imports vorhanden</p>
              <p className="text-sm">Importiere eine CSV-Datei um loszulegen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
