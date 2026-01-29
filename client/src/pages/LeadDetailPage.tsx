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
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Ticket,
  RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import type { Lead, Stage, User, Note, Reminder, Tag, Contact, CustomField, PromoCode, WorkspaceStatus } from '@/types/index';
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
  const [emailCopied, setEmailCopied] = useState(false);

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
      const lead = response.data.lead;

      // Parse enrichment_data if it's a string (PostgreSQL JSONB edge case)
      if (lead.enrichment_data && typeof lead.enrichment_data === 'string') {
        try {
          lead.enrichment_data = JSON.parse(lead.enrichment_data);
        } catch (e) {
          console.error('Failed to parse enrichment_data:', e);
          lead.enrichment_data = null;
        }
      }

      // Ensure arrays are actually arrays (handle JSON string edge cases)
      if (lead.tags && typeof lead.tags === 'string') {
        try {
          lead.tags = JSON.parse(lead.tags);
        } catch (e) {
          lead.tags = [];
        }
      }
      if (!Array.isArray(lead.tags)) {
        lead.tags = [];
      }

      if (lead.notes && typeof lead.notes === 'string') {
        try {
          lead.notes = JSON.parse(lead.notes);
        } catch (e) {
          lead.notes = [];
        }
      }
      if (!Array.isArray(lead.notes)) {
        lead.notes = [];
      }

      if (lead.reminders && typeof lead.reminders === 'string') {
        try {
          lead.reminders = JSON.parse(lead.reminders);
        } catch (e) {
          lead.reminders = [];
        }
      }
      if (!Array.isArray(lead.reminders)) {
        lead.reminders = [];
      }

      return lead as Lead;
    },
  });

  // Fetch stages
  const { data: stagesData } = useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      const response = await api.get('/stages');
      return response.data;
    },
  });

  // Fetch users (for assigned_to)
  const { data: usersData, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data.users as User[];
    },
    enabled: user?.role === 'admin',
  });

  // Debug logging
  console.log('Current user:', user);
  console.log('User role:', user?.role);
  console.log('Is admin:', user?.role === 'admin');
  console.log('Users data:', usersData);
  console.log('Users error:', usersError);

  // Fetch custom fields
  const { data: customFieldsData } = useQuery({
    queryKey: ['customFields'],
    queryFn: async () => {
      const response = await api.get('/custom-fields');
      return response.data.fields as CustomField[];
    },
  });

  // Fetch contacts - temporarily disabled due to API issue
  const { data: contactsData } = useQuery<Contact[]>({
    queryKey: ['contacts', id],
    queryFn: async () => {
      const response = await api.get(`/contacts/lead/${id}`);
      return response.data.contacts as Contact[];
    },
    enabled: false, // Disabled until contacts API is fixed
    retry: false,
  });

  // Fetch all tags
  const { data: allTagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await api.get('/tags');
      return response.data.tags as Tag[];
    },
  });

  // Fetch promo code for this lead
  const { data: promoCodeData } = useQuery({
    queryKey: ['promoCode', id],
    queryFn: async () => {
      const response = await api.get(`/promo-codes/lead/${id}`);
      return response.data.code;
    },
  });

  // Fetch workspace status when promo code exists
  const { data: workspaceStatus, isLoading: workspaceStatusLoading } = useQuery<WorkspaceStatus>({
    queryKey: ['workspaceStatus', promoCodeData?.code],
    queryFn: async () => {
      const response = await api.get('/workspace-status', {
        params: { code: promoCodeData!.code }
      });
      return response.data;
    },
    enabled: !!promoCodeData?.code,
    staleTime: 60000,
    retry: 1,
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

  // Promo code mutations
  const assignPromoCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/promo-codes/assign', { lead_id: id });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCode', id] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Fehler beim Zuweisen des Codes');
    },
  });

  const unassignPromoCodeMutation = useMutation({
    mutationFn: async (codeId: number) => {
      const response = await api.post(`/promo-codes/${codeId}/unassign`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCode', id] });
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Fehler beim Aufheben der Zuweisung');
    },
  });

  // Advisory Board mutation
  const toggleAdvisoryBoardMutation = useMutation({
    mutationFn: async (isAdvisoryBoard: boolean) => {
      const response = await api.put(`/leads/${id}/advisory-board`, { is_advisory_board: isAdvisoryBoard });
      return response.data;
    },
    onSuccess: (data, isAdvisoryBoard) => {
      // Immediately update the cached lead data
      queryClient.setQueryData(['lead', id], (oldData: Lead | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, is_advisory_board: isAdvisoryBoard };
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const handleAssignPromoCode = () => {
    assignPromoCodeMutation.mutate();
  };

  const handleUnassignPromoCode = () => {
    if (promoCodeData && confirm('Code-Zuweisung aufheben?')) {
      unassignPromoCodeMutation.mutate(promoCodeData.id);
    }
  };

  const handleToggleAdvisoryBoard = (checked: boolean) => {
    toggleAdvisoryBoardMutation.mutate(checked);
  };

  const handleCopyEmail = async () => {
    if (!promoCodeData || !leadData) return;

    let emailHtml, emailPlainText;

    if (leadData.is_advisory_board) {
      // Advisory Board Email
      emailHtml = `<p>Hallo ${leadData.name},</p>

<p>vielen Dank für Ihr Interesse am Leadtime Advisory Board!</p>

<p>Hier finden Sie alle Details zum Programm und den Vorteilen, die sich für Sie ergeben:<br>
→ <a href="https://leadt.me/advisory">https://leadt.me/advisory</a></p>

<p>Sie erhalten in einer separaten Mail eine Termineinladung zum persönlichen Onboarding mit unserem Gründer Lukas Ebner.</p>

<p>Möchten Sie vorab mehr erfahren? In diesem Überblick zeigen wir, wie Leadtime typische Herausforderungen im digitalen Projektgeschäft löst:<br>
→ <a href="https://leadt.me/quickinfo">https://leadt.me/quickinfo</a></p>

<p>Bei Fragen melden Sie sich jederzeit.</p>

<p>Wir freuen uns auf die Zusammenarbeit!</p>`;

      emailPlainText = `Hallo ${leadData.name},

vielen Dank für Ihr Interesse am Leadtime Advisory Board!

Hier finden Sie alle Details zum Programm und den Vorteilen, die sich für Sie ergeben:
→ https://leadt.me/advisory

Sie erhalten in einer separaten Mail eine Termineinladung zum persönlichen Onboarding mit unserem Gründer Lukas Ebner.

Möchten Sie vorab mehr erfahren? In diesem Überblick zeigen wir, wie Leadtime typische Herausforderungen im digitalen Projektgeschäft löst:
→ https://leadt.me/quickinfo

Bei Fragen melden Sie sich jederzeit.

Wir freuen uns auf die Zusammenarbeit!`;
    } else {
      // Standard Promo Code Email
      emailHtml = `<p>vielen Dank für das Gespräch heute!</p>

<p>Wie besprochen hier Ihr persönlicher Zugang zu Leadtime – der All-in-One-Plattform für IT-Dienstleister und Agenturen.</p>

<p><strong>So starten Sie:</strong><br>
<ol>
<li>Gehen Sie auf https://leadtime.app</li>
<li>Klicken Sie auf "Kostenlos testen"</li>
<li>Erstellen Sie Ihren Workspace</li>
<li>Geben Sie bei dem Vorgang Ihren persönlichen Code ein</li>
</ol></p>

<p><strong>Ihr Aktionscode: ${promoCodeData.code}</strong></p>

<p><strong>Ihr Vorteil:</strong><br>
<ul>
<li>30 Tage kostenlos testen – volles Team, alle Features</li>
<li>50% Rabatt im gesamten ersten Jahr</li>
</ul></p>

<p>Brauchen Sie mehr Informationen? Wie Leadtime Ihrem Unternehmen nutzen kann, erfahren Sie in diesem gratis E-Book: <a href="https://leadt.me/quickinfo">https://leadt.me/quickinfo</a></p>

<p>Bei Fragen melden Sie sich jederzeit.</p>

<p>Viel Erfolg beim Ausprobieren!</p>`;

      emailPlainText = `vielen Dank für das Gespräch heute!

Wie besprochen hier Ihr persönlicher Zugang zu Leadtime – der All-in-One-Plattform für IT-Dienstleister und Agenturen.

So starten Sie:
1. Gehen Sie auf https://leadtime.app
2. Klicken Sie auf "Kostenlos testen"
3. Erstellen Sie Ihren Workspace
4. Geben Sie bei dem Vorgang Ihren persönlichen Code ein

Ihr Aktionscode: ${promoCodeData.code}

Ihr Vorteil:
- 30 Tage kostenlos testen – volles Team, alle Features
- 50% Rabatt im gesamten ersten Jahr

Brauchen Sie mehr Informationen? Wie Leadtime Ihrem Unternehmen nutzen kann, erfahren Sie in diesem gratis E-Book: https://leadt.me/quickinfo

Bei Fragen melden Sie sich jederzeit.

Viel Erfolg beim Ausprobieren!`;
    }

    try {
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([emailHtml], { type: 'text/html' }),
        'text/plain': new Blob([emailPlainText], { type: 'text/plain' })
      });
      await navigator.clipboard.write([clipboardItem]);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy email:', error);
      alert('Fehler beim Kopieren. Bitte versuchen Sie es erneut.');
    }
  };

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

  const stages: Stage[] = stagesData?.stages || [];
  const users: User[] = usersData || [];

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
          <div className="flex items-center space-x-4">
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
            {leadData.enrichment_data?.suitability_score && (
              <div className="flex items-center space-x-2 bg-amber-50 px-4 py-2 rounded-lg">
                <span className="text-2xl">
                  {'⭐'.repeat(leadData.enrichment_data.suitability_score)}
                  {'☆'.repeat(5 - leadData.enrichment_data.suitability_score)}
                </span>
                <span className="text-lg font-semibold text-gray-700">
                  {leadData.enrichment_data.suitability_score}/5
                </span>
              </div>
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
                  className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{updateMutation.isPending ? 'Saving...' : 'Save'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
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

              {/* DEBUG: Show why assignment field might be hidden */}
              {user?.role !== 'admin' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>DEBUG:</strong> Assignment field not visible. Current role: {user?.role || 'undefined'}
                  </p>
                  {usersError && (
                    <p className="text-xs text-red-600 mt-1">
                      Users API Error: {(usersError as any)?.message || 'Unknown error'}
                    </p>
                  )}
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
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-gray-900">{leadData.phone || '-'}</p>
                      {leadData.phone_verified && (
                        <span title={`Verifiziert am ${leadData.phone_verified_at ? new Date(leadData.phone_verified_at).toLocaleDateString('de-DE') : ''}`}>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </span>
                      )}
                    </div>
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
                      className="text-amber-600 hover:text-amber-700"
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
                                className="w-4 h-4 text-amber-600 border-gray-300 rounded"
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

          {/* Zusatzinfos (Enrichment Data) */}
          {leadData.enrichment_data && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Zusatzinfos</h2>
              </div>

              {/* Summary */}
              {leadData.enrichment_data.summary && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-800">{leadData.enrichment_data.summary}</p>
                </div>
              )}

              {/* Website Status */}
              {leadData.enrichment_data.website_status && (
                <div className="mb-4 flex items-center gap-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                    leadData.enrichment_data.website_status === 'online' 
                      ? 'bg-green-100 text-green-800' 
                      : leadData.enrichment_data.website_status === 'offline'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    Website: {leadData.enrichment_data.website_status}
                  </span>
                </div>
              )}

              <div className="space-y-4">
                {/* Services */}
                {Array.isArray(leadData.enrichment_data.services) && leadData.enrichment_data.services.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Services & Leistungen</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {leadData.enrichment_data.services.map((service, idx) => (
                        <span key={idx} className="inline-flex px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products */}
                {Array.isArray(leadData.enrichment_data.products) && leadData.enrichment_data.products.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Produkte</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {leadData.enrichment_data.products.map((product, idx) => (
                        <span key={idx} className="inline-flex px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full">
                          {product}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Technologies */}
                {Array.isArray(leadData.enrichment_data.technologies) && leadData.enrichment_data.technologies.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Technologien</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {leadData.enrichment_data.technologies.map((tech, idx) => (
                        <span key={idx} className="inline-flex px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Focus */}
                {leadData.enrichment_data.focus && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Hauptfokus</label>
                    <p className="mt-1 text-gray-900">{leadData.enrichment_data.focus}</p>
                  </div>
                )}

                {/* Team Info */}
                {leadData.enrichment_data.team_info && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Team-Größe</label>
                    <p className="mt-1 text-gray-900">{leadData.enrichment_data.team_info}</p>
                  </div>
                )}

                {/* Company Age / Founding Year */}
                {(leadData.enrichment_data.company_age || leadData.enrichment_data.founding_year) && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Gründung</label>
                    <p className="mt-1 text-gray-900">
                      {leadData.enrichment_data.founding_year && `Gegründet ${leadData.enrichment_data.founding_year}`}
                      {leadData.enrichment_data.company_age && leadData.enrichment_data.founding_year && ' • '}
                      {leadData.enrichment_data.company_age && `${leadData.enrichment_data.company_age} Jahre alt`}
                    </p>
                  </div>
                )}

                {/* Clients */}
                {Array.isArray(leadData.enrichment_data.clients) && leadData.enrichment_data.clients.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Bekannte Kunden</label>
                    <ul className="mt-2 space-y-1">
                      {leadData.enrichment_data.clients.map((client, idx) => (
                        <li key={idx} className="text-sm text-gray-800 flex items-start">
                          <span className="text-gray-400 mr-2">•</span>
                          {client}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recent Events */}
                {Array.isArray(leadData.enrichment_data.recent_events) && leadData.enrichment_data.recent_events.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Aktuelle Ereignisse</label>
                    <ul className="mt-2 space-y-2">
                      {leadData.enrichment_data.recent_events.map((event, idx) => (
                        <li key={idx} className="text-sm text-gray-800 p-2 bg-gray-50 rounded">
                          {event}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suitability Reasons */}
                {Array.isArray(leadData.enrichment_data.suitability_reasons) && leadData.enrichment_data.suitability_reasons.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Bewertung</label>
                    <ul className="mt-2 space-y-1">
                      {leadData.enrichment_data.suitability_reasons.map((reason, idx) => (
                        <li key={idx} className="text-sm text-gray-800">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Enrichment Date */}
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Enriched: {new Date(leadData.enrichment_data.enriched_at).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
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
              {allTagsData?.filter(tag => !Array.isArray(leadData.tags) || !leadData.tags.some(lt => lt.id === tag.id)).map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>

            {/* Current tags */}
            <div className="flex flex-wrap gap-2">
              {Array.isArray(leadData.tags) && leadData.tags.length > 0 ? (
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
                className="text-amber-600 hover:text-amber-700"
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
                    className="px-3 py-1 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    {addNoteMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {Array.isArray(leadData.notes) && leadData.notes.length > 0 ? (
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
                className="text-amber-600 hover:text-amber-700"
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
                    className="px-3 py-1 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
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
                          className="p-1 text-gray-400 hover:text-amber-600"
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
                          className="hover:text-amber-600"
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
                          className="hover:text-amber-600"
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
                className="text-amber-600 hover:text-amber-700"
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
                    className="px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    {addReminderMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {Array.isArray(leadData.reminders) && leadData.reminders.length > 0 ? (
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
                    className="text-amber-600 hover:text-amber-700"
                  >
                    View on North Data →
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Promo Code Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Aktionscode
            </h3>
            {promoCodeData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-lg font-semibold text-gray-900">
                    {promoCodeData.code}
                  </div>
                  <button
                    onClick={handleUnassignPromoCode}
                    disabled={unassignPromoCodeMutation.isPending}
                    className="text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Zuweisung aufheben"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  <div>
                    ausgegeben: {promoCodeData.assigned_at ? new Date(promoCodeData.assigned_at).toLocaleDateString('de-DE') : '-'}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span>Status:</span>
                    {workspaceStatusLoading ? (
                      <span className="flex items-center gap-1 text-gray-500 font-medium">
                        lädt...
                      </span>
                    ) : workspaceStatus?.found && workspaceStatus.workspace?.rootUserHasLoggedIn ? (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        Workspace Aktiv 🟢
                      </span>
                    ) : workspaceStatus?.found && workspaceStatus.workspace ? (
                      <span className="flex items-center gap-1 text-yellow-600 font-medium">
                        Workspace erstellt 🟡
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        Warten 🔴
                      </span>
                    )}
                  </div>
                </div>

                {/* Workspace Status Section */}
                {workspaceStatusLoading ? (
                  <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs text-gray-500">Lade Workspace-Status...</p>
                  </div>
                ) : workspaceStatus?.found && workspaceStatus.workspace ? (
                  <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-green-600 font-semibold">✅ Workspace erstellt</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        <a
                          href={`https://leadtime.app/system/admin/workspaces/${workspaceStatus.workspace.id}/overview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-800 underline"
                        >
                          {workspaceStatus.workspace.name}
                        </a>
                        <span className="text-gray-500 ml-1">({workspaceStatus.workspace.id})</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        erstellt: {new Date(workspaceStatus.workspace.createdAt).toLocaleDateString('de-DE')}
                      </div>

                      <div className="pt-2 border-t border-green-200">
                        <div className="flex items-center gap-2 text-sm mb-1">
                          {workspaceStatus.workspace.rootUserHasLoggedIn ? (
                            <span className="text-green-600 font-semibold">✅ Root-User eingeloggt</span>
                          ) : (
                            <span className="text-amber-600 font-semibold">⏳ Noch nicht eingeloggt</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-700">
                          E-Mail: {workspaceStatus.workspace.rootUserEmail}
                        </div>
                        {workspaceStatus.workspace.rootUserName && (
                          <div className="text-xs text-gray-700">
                            Name: {workspaceStatus.workspace.rootUserName}
                          </div>
                        )}
                        {workspaceStatus.workspace.lastLoginAt && (
                          <div className="text-xs text-gray-600 mt-1">
                            Letzter Login: {new Date(workspaceStatus.workspace.lastLoginAt).toLocaleDateString('de-DE', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : workspaceStatus !== undefined ? (
                  <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
                    <p className="text-sm text-amber-700 font-medium">❌ Noch kein Workspace</p>
                    <p className="text-xs text-amber-600 mt-1">Kunde hat Code noch nicht verwendet</p>
                  </div>
                ) : null}

                <button
                  onClick={handleCopyEmail}
                  className="w-full mt-4 px-4 py-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {emailCopied ? (
                    <>
                      ✓ Kopiert
                    </>
                  ) : (
                    <>
                      📋 Mail kopieren
                    </>
                  )}
                </button>

                {/* Advisory Board Checkbox */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leadData?.is_advisory_board || false}
                      onChange={(e) => handleToggleAdvisoryBoard(e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Advisory Board</span>
                  </label>

                  {leadData?.is_advisory_board && (
                    <button
                      onClick={() => window.open('https://leadt.me/call', '_blank')}
                      className="w-full mt-3 px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                    >
                      📅 Termin buchen
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <button
                  onClick={handleAssignPromoCode}
                  disabled={assignPromoCodeMutation.isPending}
                  className="w-full px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {assignPromoCodeMutation.isPending ? 'Lade...' : 'Aktions-Code anfordern'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
