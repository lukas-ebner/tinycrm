import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, GripVertical } from 'lucide-react';
import api from '@/lib/api';
import type { Stage } from '@/types/index';

const PRESET_COLORS = [
  '#6B7280', // gray
  '#EF4444', // red
  '#F59E0B', // orange
  '#10B981', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
];

export default function StagesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#6B7280',
    position: 0,
  });
  const queryClient = useQueryClient();

  // Fetch stages
  const { data: stagesData, isLoading } = useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      const response = await api.get('/stages');
      return response.data;
    },
  });

  // Create stage mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/stages', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] });
      handleCloseModal();
    },
  });

  // Update stage mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const response = await api.put(`/stages/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] });
      handleCloseModal();
    },
  });

  // Delete stage mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/stages/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stages'] });
    },
  });

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingStage(null);
    setFormData({
      name: '',
      color: '#6B7280',
      position: 0,
    });
  };

  const handleOpenCreate = () => {
    const stages: Stage[] = stagesData?.stages || [];
    setEditingStage(null);
    setFormData({
      name: '',
      color: '#6B7280',
      position: stages.length,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (stage: Stage) => {
    setEditingStage(stage);
    setFormData({
      name: stage.name,
      color: stage.color,
      position: stage.position,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingStage) {
      updateMutation.mutate({ id: editingStage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (stage: Stage) => {
    if (
      window.confirm(
        `Are you sure you want to delete stage "${stage.name}"? Leads in this stage will become unassigned.`
      )
    ) {
      deleteMutation.mutate(stage.id);
    }
  };

  const stages: Stage[] = stagesData?.stages || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pipeline Stages</h1>
          <p className="text-gray-600 mt-1">Manage your sales pipeline stages</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Stage</span>
        </button>
      </div>

      {/* Stages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <GripVertical className="w-5 h-5 text-gray-400" />
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="text-lg font-semibold text-gray-900">{stage.name}</h3>
              </div>

              <div className="flex space-x-1">
                <button
                  onClick={() => handleOpenEdit(stage)}
                  className="p-1 text-gray-400 hover:text-amber-600"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(stage)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              <p>Position: {stage.position + 1}</p>
              <p className="text-xs mt-1">
                Created: {new Date(stage.created_at).toLocaleDateString('de-DE')}
              </p>
            </div>
          </div>
        ))}

        {stages.length === 0 && (
          <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No stages found. Create your first pipeline stage to get started.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingStage ? 'Edit Stage' : 'Create Stage'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Kontaktiert, Qualifiziert"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-amber-500 focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex space-x-2 mb-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#6B7280"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-amber-500 focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <input
                  type="number"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: parseInt(e.target.value) })
                  }
                  min="0"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-amber-500 focus:border-amber-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers appear first in the pipeline
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingStage
                    ? 'Update'
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
