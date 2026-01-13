import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit2,
  Save,
  X,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building2,
  Users,
  Euro,
  Calendar,
  MessageSquare,
  Bell,
  Tag as TagIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import type { Lead, Stage, User, Note, Reminder, Tag, Contact } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Lead>>({});
  const [newNote, setNewNote] = useState('');
  const [newReminder, setNewReminder] = useState({ due_at: '', reason: '' });
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    role: '',
    email: '',
    phone: '',
    notes: '',
  });

  // Navigation context
  const [navigationIds, setNavigationIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Load navigation context from sessionStorage
  useEffect(() => {
    const storedIds = sessionStorage.getItem('leadNavigationIds');
    if (storedIds) {
      try {
        const ids = JSON.parse(storedIds);
        setNavigationIds(ids);
        const index = ids.indexOf(parseInt(id!));
        setCurrentIndex(index);
      } catch (e) {
        console.error('Failed to parse navigation IDs:', e);
      }
    }
  }, [id]);

  // Fetch lead data
  const { data: leadData, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const response = await api.get(`/leads/${id}`);
      return response.data.lead as Lead;
    },
  });

  // Fetch stages
  const { data: stagesData } = useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      const response = await api.get('/stages');
      return response.data.stages as Stage[];
    },
  });

  // Fetch users (for assigned_to)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data.users as User[];
    },
    enabled: user?.role === 'admin',
  });

  // Fetch custom fields
  const { data: customFieldsData } = useQuery({
    queryKey: ['customFields'],
    queryFn: async () => {
      const response = await api.get('/custom-fields');
      return response.data.fields as CustomField[];
    },
  });

  // Fetch contacts
  const { data: contactsData } = useQuery({
    queryKey: ['contacts', id],
    queryFn: async () => {
      const response = await api.get(`/contacts/lead/${id}`);
      return response.data.contacts as Contact[];
    },
  });

  // Fetch all tags
  const { data: allTagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await api.get('/tags');
      return response.data.tags as Tag[];
    },
  });

  useEffect(() => {
    if (leadData) {
      setEditData(leadData);
    }
  }, [leadData]);

  // Update lead mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Lead>) => {
      const response = await api.put(`/leads/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsEditing(false);
    },
  });

  // Quick update stage mutation (without full edit mode)
  const updateStageMutation = useMutation({
    mutationFn: async (stageId: number | undefined) => {
      const response = await api.put(`/leads/${id}`, { stage_id: stageId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // Quick update assigned to mutation (admins only, without full edit mode)
  const updateAssignedToMutation = useMutation({
    mutationFn: async (assignedTo: number | undefined) => {
      const response = await api.put(`/leads/${id}`, { assigned_to: assignedTo });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post('/notes', {
        lead_id: id,
        content,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      setNewNote('');
      setShowNoteForm(false);
    },
  });

  // Add reminder mutation
  const addReminderMutation = useMutation({
    mutationFn: async (data: { due_at: string; reason: string }) => {
      const response = await api.post('/reminders', {
        lead_id: id,
        ...data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      setNewReminder({ due_at: '', reason: '' });
      setShowReminderForm(false);
    },
  });

  // Contact mutations
  const addContactMutation = useMutation({
    mutationFn: async (data: typeof newContact) => {
      const response = await api.post('/contacts', {
        lead_id: id,
        ...data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
      setNewContact({
        first_name: '',
        last_name: '',
        role: '',
        email: '',
        phone: '',
        notes: '',
      });
      setShowContactForm(false);
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id: contactId, data }: { id: number; data: Partial<typeof newContact> }) => {
      const response = await api.put(`/contacts/${contactId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
      setEditingContact(null);
      setShowContactForm(false);
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const response = await api.delete(`/contacts/${contactId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', id] });
    },
  });

  // Tag mutations
  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await api.post(`/leads/${id}/tags`, { tag_id: tagId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await api.delete(`/leads/${id}/tags/${tagId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleCancel = () => {
    setEditData(leadData || {});
    setIsEditing(false);
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNoteMutation.mutate(newNote);
    }
  };

  const handleAddReminder = () => {
    if (newReminder.due_at && newReminder.reason) {
      addReminderMutation.mutate(newReminder);
    }
  };

  const handleAddContact = () => {
    if (newContact.first_name.trim() && newContact.last_name.trim()) {
      if (editingContact) {
        updateContactMutation.mutate({ id: editingContact.id, data: newContact });
      } else {
        addContactMutation.mutate(newContact);
      }
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setNewContact({
      first_name: contact.first_name,
      last_name: contact.last_name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
    });
    setShowContactForm(true);
  };

  const handleDeleteContact = (contact: Contact) => {
    if (window.confirm(`Kontakt "${contact.first_name} ${contact.last_name}" wirklich löschen?`)) {
      deleteContactMutation.mutate(contact.id);
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevId = navigationIds[currentIndex - 1];
      navigate(`/leads/${prevId}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < navigationIds.length - 1) {
      const nextId = navigationIds[currentIndex + 1];
      navigate(`/leads/${nextId}`);
    }
  };

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < navigationIds.length - 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!leadData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Lead not found</div>
      </div>
    );
  }

  const stages = stagesData || [];
  const users = usersData || [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/leads"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Leads</span>
          </Link>

          {/* Navigation buttons */}
          {navigationIds.length > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevious}
                disabled={!hasPrevious}
                className="flex items-center space-x-1 px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <span className="text-sm text-gray-500">
                {currentIndex + 1} / {navigationIds.length}
              </span>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="flex items-center space-x-1 px-3 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="border border-gray-300 rounded-md px-3 py-2 w-full"
                />
              ) : (
                leadData.name
              )}
            </h1>
            {leadData.legal_form && (
              <p className="text-gray-600 mt-1">{leadData.legal_form}</p>
            )}
          </div>

          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{updateMutation.isPending ? 'Saving...' : 'Save'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stage */}
              <div>
                <label className="text-sm font-medium text-gray-700">Stage</label>
                <select
                  value={isEditing ? (editData.stage_id || '') : (leadData.stage_id || '')}
                  onChange={(e) => {
                    const newStageId = e.target.value ? parseInt(e.target.value) : undefined;
                    if (isEditing) {
                      setEditData({ ...editData, stage_id: newStageId });
                    } else {
                      updateStageMutation.mutate(newStageId);
                    }
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={updateStageMutation.isPending}
                >
                  <option value="">Select stage</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned To (admins only, always editable) */}
              {user?.role === 'admin' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Assigned To</label>
                  <select
                    value={isEditing ? (editData.assigned_to || '') : (leadData.assigned_to || '')}
                    onChange={(e) => {
                      const newAssignedTo = e.target.value ? parseInt(e.target.value) : undefined;
                      if (isEditing) {
                        setEditData({
                          ...editData,
                          assigned_to: newAssignedTo,
                        });
                      } else {
                        updateAssignedToMutation.mutate(newAssignedTo);
                      }
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    disabled={updateAssignedToMutation.isPending}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>

            <div className="space-y-3">
              {/* Address */}
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">Address</label>
                  {isEditing ? (
                    <div className="mt-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Street"
                        value={editData.street || ''}
                        onChange={(e) => setEditData({ ...editData, street: e.target.value })}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="ZIP"
                          value={editData.zip || ''}
                          onChange={(e) => setEditData({ ...editData, zip: e.target.value })}
                          className="block w-24 border border-gray-300 rounded-md px-3 py-2"
                        />
                        <input
                          type="text"
                          placeholder="City"
                          value={editData.city || ''}
                          onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                          className="block flex-1 border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-900">
                      {leadData.street && <>{leadData.street}<br /></>}
                      {leadData.zip} {leadData.city}
                    </p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start space-x-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{leadData.phone || '-'}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{leadData.email || '-'}</p>
                  )}
                </div>
              </div>

              {/* Website */}
              <div className="flex items-start space-x-3">
                <Globe className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.website || ''}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : leadData.website ? (
                    <a
                      href={leadData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-orange-600"
                    >
                      {leadData.website}
                    </a>
                  ) : (
                    <p className="text-gray-900">-</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          {customFieldsData && customFieldsData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Custom Fields</h2>

              <div className="space-y-4">
                {customFieldsData.map((field) => {
                  const fieldValue = leadData.custom_fields?.[field.name];

                  return (
                    <div key={field.id}>
                      <label className="text-sm font-medium text-gray-700">
                        {field.name}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {isEditing ? (
                        <>
                          {field.field_type === 'text' && (
                            <input
                              type="text"
                              value={
                                (editData.custom_fields as any)?.[field.name] || ''
                              }
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  custom_fields: {
                                    ...(editData.custom_fields || {}),
                                    [field.name]: e.target.value,
                                  },
                                })
                              }
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                          )}
                          {field.field_type === 'number' && (
                            <input
                              type="number"
                              value={
                                (editData.custom_fields as any)?.[field.name] || ''
                              }
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  custom_fields: {
                                    ...(editData.custom_fields || {}),
                                    [field.name]: parseFloat(e.target.value) || '',
                                  },
                                })
                              }
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                          )}
                          {field.field_type === 'date' && (
                            <input
                              type="date"
                              value={
                                (editData.custom_fields as any)?.[field.name] || ''
                              }
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  custom_fields: {
                                    ...(editData.custom_fields || {}),
                                    [field.name]: e.target.value,
                                  },
                                })
                              }
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            />
                          )}
                          {field.field_type === 'dropdown' && (
                            <select
                              value={
                                (editData.custom_fields as any)?.[field.name] || ''
                              }
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  custom_fields: {
                                    ...(editData.custom_fields || {}),
                                    [field.name]: e.target.value,
                                  },
                                })
                              }
                              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                            >
                              <option value="">Select...</option>
                              {field.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}
                          {field.field_type === 'checkbox' && (
                            <div className="mt-1">
                              <input
                                type="checkbox"
                                checked={
                                  !!(editData.custom_fields as any)?.[field.name]
                                }
                                onChange={(e) =>
                                  setEditData({
                                    ...editData,
                                    custom_fields: {
                                      ...(editData.custom_fields || {}),
                                      [field.name]: e.target.checked,
                                    },
                                  })
                                }
                                className="w-4 h-4 text-primary border-gray-300 rounded"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-gray-900">
                          {field.field_type === 'checkbox'
                            ? fieldValue
                              ? 'Yes'
                              : 'No'
                            : fieldValue || '-'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Business Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Details</h2>

            <div className="space-y-4">
              {/* Register ID */}
              <div>
                <label className="text-sm font-medium text-gray-700">Register ID</label>
                <p className="mt-1 text-gray-900">{leadData.register_id || '-'}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">NACE Code</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.nace_code || ''}
                    onChange={(e) => setEditData({ ...editData, nace_code: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{leadData.nace_code || '-'}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Business Purpose</label>
                {isEditing ? (
                  <textarea
                    value={editData.business_purpose || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, business_purpose: e.target.value })
                    }
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                ) : (
                  <p className="mt-1 text-gray-900">{leadData.business_purpose || '-'}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">CEO 1</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.ceo_1 || ''}
                      onChange={(e) => setEditData({ ...editData, ceo_1: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{leadData.ceo_1 || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">CEO 2</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.ceo_2 || ''}
                      onChange={(e) => setEditData({ ...editData, ceo_2: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{leadData.ceo_2 || '-'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start space-x-2">
                  <Euro className="w-5 h-5 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">Revenue (EUR)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.revenue_eur || ''}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            revenue_eur: parseFloat(e.target.value) || undefined,
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    ) : (
                      <p className="mt-1 text-gray-900">
                        {leadData.revenue_eur
                          ? new Intl.NumberFormat('de-DE', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(leadData.revenue_eur)
                          : '-'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <Users className="w-5 h-5 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">Employees</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.employee_count || ''}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            employee_count: parseInt(e.target.value) || undefined,
                          })
                        }
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    ) : (
                      <p className="mt-1 text-gray-900">{leadData.employee_count || '-'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tags */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <TagIcon className="w-5 h-5" />
              <span>Tags</span>
            </h3>

            {/* Tag selector */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addTagMutation.mutate(parseInt(e.target.value));
                  e.target.value = ''; // Reset selection
                }
              }}
              className="w-full mb-3 border border-gray-300 rounded-md px-3 py-2 text-sm"
              disabled={addTagMutation.isPending}
            >
              <option value="">+ Add tag...</option>
              {allTagsData?.filter(tag => !leadData.tags?.some(lt => lt.id === tag.id)).map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>

            {/* Current tags */}
            <div className="flex flex-wrap gap-2">
              {leadData.tags && leadData.tags.length > 0 ? (
                leadData.tags.map((tag: Tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center space-x-1 px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full"
                  >
                    <span>{tag.name}</span>
                    <button
                      onClick={() => removeTagMutation.mutate(tag.id)}
                      disabled={removeTagMutation.isPending}
                      className="hover:text-red-600 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No tags</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Notes</span>
              </h3>
              <button
                onClick={() => setShowNoteForm(!showNoteForm)}
                className="text-primary hover:text-orange-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showNoteForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Write a note..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <div className="flex justify-end space-x-2 mt-2">
                  <button
                    onClick={() => {
                      setShowNoteForm(false);
                      setNewNote('');
                    }}
                    className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
                  >
                    {addNoteMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {leadData.notes && leadData.notes.length > 0 ? (
                leadData.notes.map((note: Note) => (
                  <div key={note.id} className="border-l-4 border-primary pl-3 py-2">
                    <p className="text-sm text-gray-900">{note.content}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {note.user_name} •{' '}
                      {new Date(note.created_at).toLocaleString('de-DE')}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No notes yet</p>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Ansprechpartner</span>
              </h3>
              <button
                onClick={() => {
                  setEditingContact(null);
                  setNewContact({
                    first_name: '',
                    last_name: '',
                    role: '',
                    email: '',
                    phone: '',
                    notes: '',
                  });
                  setShowContactForm(!showContactForm);
                }}
                className="text-primary hover:text-orange-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showContactForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Vorname"
                    value={newContact.first_name}
                    onChange={(e) =>
                      setNewContact({ ...newContact, first_name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Nachname"
                    value={newContact.last_name}
                    onChange={(e) =>
                      setNewContact({ ...newContact, last_name: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Rolle (z.B. Geschäftsführer)"
                  value={newContact.role}
                  onChange={(e) =>
                    setNewContact({ ...newContact, role: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="E-Mail"
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact({ ...newContact, email: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Telefon"
                  value={newContact.phone}
                  onChange={(e) =>
                    setNewContact({ ...newContact, phone: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <textarea
                  placeholder="Notizen"
                  value={newContact.notes}
                  onChange={(e) =>
                    setNewContact({ ...newContact, notes: e.target.value })
                  }
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowContactForm(false);
                      setEditingContact(null);
                      setNewContact({
                        first_name: '',
                        last_name: '',
                        role: '',
                        email: '',
                        phone: '',
                        notes: '',
                      });
                    }}
                    className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleAddContact}
                    disabled={
                      !newContact.first_name.trim() ||
                      !newContact.last_name.trim() ||
                      addContactMutation.isPending ||
                      updateContactMutation.isPending
                    }
                    className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
                  >
                    {addContactMutation.isPending || updateContactMutation.isPending
                      ? 'Speichern...'
                      : editingContact
                      ? 'Aktualisieren'
                      : 'Hinzufügen'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {contactsData && contactsData.length > 0 ? (
                contactsData.map((contact: Contact) => (
                  <div
                    key={contact.id}
                    className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {contact.first_name} {contact.last_name}
                        </p>
                        {contact.role && (
                          <p className="text-xs text-gray-600">{contact.role}</p>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="p-1 text-gray-400 hover:text-primary"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {contact.email && (
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <Mail className="w-3 h-3" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:text-primary"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <Phone className="w-3 h-3" />
                        <a
                          href={`tel:${contact.phone}`}
                          className="hover:text-primary"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.notes && (
                      <p className="text-xs text-gray-500 mt-1">{contact.notes}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Keine Ansprechpartner</p>
              )}
            </div>
          </div>

          {/* Reminders */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Reminders</span>
              </h3>
              <button
                onClick={() => setShowReminderForm(!showReminderForm)}
                className="text-primary hover:text-orange-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {showReminderForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-2">
                <input
                  type="datetime-local"
                  value={newReminder.due_at}
                  onChange={(e) =>
                    setNewReminder({ ...newReminder, due_at: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Reason"
                  value={newReminder.reason}
                  onChange={(e) =>
                    setNewReminder({ ...newReminder, reason: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setShowReminderForm(false);
                      setNewReminder({ due_at: '', reason: '' });
                    }}
                    className="px-3 py-1 text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddReminder}
                    disabled={
                      !newReminder.due_at ||
                      !newReminder.reason ||
                      addReminderMutation.isPending
                    }
                    className="px-3 py-1 bg-primary text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
                  >
                    {addReminderMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {leadData.reminders && leadData.reminders.length > 0 ? (
                leadData.reminders.map((reminder: Reminder) => (
                  <div
                    key={reminder.id}
                    className={`p-3 rounded-lg ${
                      reminder.completed ? 'bg-gray-50' : 'bg-orange-50'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <Calendar className="w-4 h-4 text-gray-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {reminder.reason}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(reminder.due_at).toLocaleString('de-DE')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No reminders</p>
              )}
            </div>
          </div>

          {/* Meta Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Information</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Created:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(leadData.created_at).toLocaleDateString('de-DE')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Last Updated:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(leadData.updated_at).toLocaleDateString('de-DE')}
                </span>
              </div>
              {leadData.northdata_url && (
                <div>
                  <a
                    href={leadData.northdata_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-orange-600"
                  >
                    View on North Data →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
