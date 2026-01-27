import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Filter, X } from 'lucide-react';
import api from '@/lib/api';
import type { PromoCode, PromoCodeList } from '@/types/index';

export default function PromoCodesPage() {
  const queryClient = useQueryClient();
  const [showImportModal, setShowImportModal] = useState(false);
  const [listIdFilter, setListIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch promo code lists
  const { data: listsData } = useQuery({
    queryKey: ['promoCodeLists'],
    queryFn: async () => {
      const response = await api.get('/promo-codes/lists');
      return response.data;
    },
  });

  // Fetch promo codes with filters
  const { data: codesData, isLoading } = useQuery({
    queryKey: ['promoCodes', listIdFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (listIdFilter) params.append('list_id', listIdFilter);
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/promo-codes?${params}`);
      return response.data;
    },
  });

  const lists: PromoCodeList[] = listsData?.lists || [];
  const codes: PromoCode[] = codesData?.codes || [];

  // Unassign mutation
  const unassignMutation = useMutation({
    mutationFn: async (codeId: number) => {
      const response = await api.post(`/promo-codes/${codeId}/unassign`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCodes'] });
      queryClient.invalidateQueries({ queryKey: ['promoCodeLists'] });
    },
  });

  const handleUnassign = (codeId: number) => {
    if (confirm('Code-Zuweisung wirklich aufheben?')) {
      unassignMutation.mutate(codeId);
    }
  };

  const formatDate = (timestamp: number | string | null) => {
    if (!timestamp) return '-';
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
    return date.toLocaleDateString('de-DE');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-yellow-100 text-yellow-800';
      case 'redeemed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Verfügbar';
      case 'assigned': return 'Zugewiesen';
      case 'redeemed': return 'Eingelöst';
      default: return status;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promo Codes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {codes.length} Codes gesamt
          </p>
        </div>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>CSV Importieren</span>
        </button>
      </div>

      {/* Stats Cards */}
      {lists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Listen</p>
            <p className="text-2xl font-bold text-gray-900">{lists.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Verfügbar</p>
            <p className="text-2xl font-bold text-blue-600">
              {lists.reduce((sum, list) => sum + (list.available_codes || 0), 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Zugewiesen</p>
            <p className="text-2xl font-bold text-yellow-600">
              {lists.reduce((sum, list) => sum + (list.assigned_codes || 0), 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Eingelöst</p>
            <p className="text-2xl font-bold text-green-600">
              {lists.reduce((sum, list) => sum + (list.redeemed_codes || 0), 0)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Filter className="w-4 h-4 inline mr-1" />
            Liste
          </label>
          <select
            value={listIdFilter}
            onChange={(e) => setListIdFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Alle Listen</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.total_codes} Codes)
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Alle Status</option>
            <option value="available">Verfügbar</option>
            <option value="assigned">Zugewiesen</option>
            <option value="redeemed">Eingelöst</option>
          </select>
        </div>
      </div>

      {/* Codes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liste
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zugewiesen an
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ausgegeben am
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ablaufdatum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Laden...
                </td>
              </tr>
            ) : codes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Keine Codes gefunden
                </td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {code.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {code.list_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(code.status)}`}>
                      {getStatusLabel(code.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {code.lead_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(code.assigned_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(code.expires_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {code.status === 'assigned' && (
                      <button
                        onClick={() => handleUnassign(code.id)}
                        disabled={unassignMutation.isPending}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Zuweisung aufheben"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            queryClient.invalidateQueries({ queryKey: ['promoCodeLists'] });
            queryClient.invalidateQueries({ queryKey: ['promoCodes'] });
          }}
        />
      )}
    </div>
  );
}

// Import Modal Component
function ImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [listName, setListName] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const importMutation = useMutation({
    mutationFn: async (data: { name: string; csv_content: string }) => {
      const response = await api.post('/promo-codes/import', data);
      return response.data;
    },
    onSuccess: (data) => {
      alert(`Erfolgreich ${data.imported_count} Codes importiert!`);
      onSuccess();
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Import fehlgeschlagen');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!listName.trim()) {
      setError('Listenname ist erforderlich');
      return;
    }

    if (!csvFile) {
      setError('CSV-Datei ist erforderlich');
      return;
    }

    try {
      const csvContent = await csvFile.text();
      importMutation.mutate({ name: listName, csv_content: csvContent });
    } catch (err) {
      setError('Fehler beim Lesen der CSV-Datei');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Promo Codes importieren</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Listenname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="z.B. Regional Ostbayern Q1 2026"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CSV-Datei <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: code, promotion_code_id, active, max_redemptions, times_redeemed, expires_at, created
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={importMutation.isPending}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? 'Importiere...' : 'Importieren'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
