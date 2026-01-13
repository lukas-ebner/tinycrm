import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import type { CustomField } from '@/types/index';

type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox';

export default function CustomFieldsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    field_type: 'text' as FieldType,
    options: [] as string[],
    required: false,
    position: 0,
  });
  const [optionsInput, setOptionsInput] = useState('');
  const queryClient = useQueryClient();

  // Fetch custom fields
  const { data: fieldsData, isLoading } = useQuery({
    queryKey: ['customFields'],
    queryFn: async () => {
      const response = await api.get('/custom-fields');
      return response.data;
    },
  });

  // Create field mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/custom-fields', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customFields'] });
      handleCloseModal();
    },
  });

  // Update field mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const response = await api.put(`/custom-fields/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customFields'] });
      handleCloseModal();
    },
  });

  // Delete field mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/custom-fields/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customFields'] });
    },
  });

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingField(null);
    setFormData({
      name: '',
      field_type: 'text',
      options: [],
      required: false,
      position: 0,
    });
    setOptionsInput('');
  };

  const handleOpenCreate = () => {
    const fields: CustomField[] = fieldsData?.fields || [];
    setEditingField(null);
    setFormData({
      name: '',
      field_type: 'text',
      options: [],
      required: false,
      position: fields.length,
    });
    setOptionsInput('');
    setShowModal(true);
  };

  const handleOpenEdit = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      field_type: field.field_type,
      options: field.options || [],
      required: field.required,
      position: field.position,
    });
    setOptionsInput(field.options?.join(', ') || '');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse options for dropdown
    const finalData = {
      ...formData,
      options:
        formData.field_type === 'dropdown'
          ? optionsInput.split(',').map((opt) => opt.trim()).filter(Boolean)
          : [],
    };

    if (editingField) {
      updateMutation.mutate({ id: editingField.id, data: finalData });
    } else {
      createMutation.mutate(finalData);
    }
  };

  const handleDelete = (field: CustomField) => {
    if (
      window.confirm(
        `Are you sure you want to delete custom field "${field.name}"? This will remove all data stored in this field for all leads.`
      )
    ) {
      deleteMutation.mutate(field.id);
    }
  };

  const fields: CustomField[] = fieldsData?.fields || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const fieldTypeLabels = {
    text: 'Text',
    number: 'Number',
    date: 'Date',
    dropdown: 'Dropdown',
    checkbox: 'Checkbox',
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-gray-600 mt-1">
            Define custom fields to capture additional lead information
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Field</span>
        </button>
      </div>

      {/* Fields Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Field Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Required
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fields.map((field) => (
              <tr key={field.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{field.name}</div>
                  {field.options && field.options.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Options: {field.options.join(', ')}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {fieldTypeLabels[field.field_type]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      field.required
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {field.required ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {field.position + 1}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(field.created_at).toLocaleDateString('de-DE')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleOpenEdit(field)}
                    className="text-amber-600 hover:text-amber-700 mr-3"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(field)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {fields.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No custom fields found. Create your first custom field to extend lead data.
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
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
                  Field Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Industry, Company Size"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-amber-500 focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field Type
                </label>
                <select
                  value={formData.field_type}
                  onChange={(e) =>
                    setFormData({ ...formData, field_type: e.target.value as FieldType })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-amber-500 focus:border-amber-600"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                </select>
              </div>

              {formData.field_type === 'dropdown' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dropdown Options
                  </label>
                  <input
                    type="text"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    placeholder="Option1, Option2, Option3"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-amber-500 focus:border-amber-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separate options with commas
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) =>
                    setFormData({ ...formData, required: e.target.checked })
                  }
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="required" className="ml-2 text-sm text-gray-700">
                  Required field
                </label>
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
                  Order in which the field appears in forms
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
                    : editingField
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
