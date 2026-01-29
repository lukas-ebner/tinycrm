import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, ChevronLeft, ChevronRight, ExternalLink, Phone, Mail, Globe, MapPin,
  MessageSquare, Bell, Plus, Calendar, Tag as TagIcon, Building2, Users, CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import type { Lead, Stage, Note, Reminder, Tag, WorkspaceStatus } from '@/types/index';

interface LeadDetailModalProps {
  leadId: number;
  leadIds: number[];
  onClose: () => void;
  onNavigate: (leadId: number) => void;
}

export default function LeadDetailModal({ leadId, leadIds, onClose, onNavigate }: LeadDetailModalProps) {
  const currentIndex = leadIds.indexOf(leadId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < leadIds.length - 1;
  const queryClient = useQueryClient();

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [newReminder, setNewReminder] = useState({ due_at: '', reason: '' });
  const [emailCopied, setEmailCopied] = useState(false);

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const response = await api.get(`/leads/${leadId}`);
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

  const { data: stagesData } = useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      const response = await api.get('/stages');
      return response.data;
    },
  });

  const { data: allTagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await api.get('/tags');
      const tags = response.data.tags;
      return Array.isArray(tags) ? tags as Tag[] : [];
    },
  });

  // Fetch promo code for this lead
  const { data: promoCodeData } = useQuery({
    queryKey: ['promoCode', leadId],
    queryFn: async () => {
      const response = await api.get(`/promo-codes/lead/${leadId}`);
      return response.data.code;
    },
    enabled: !!leadId,
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
    enabled: !!promoCodeData?.code, // Only fetch when code exists
    staleTime: 60000, // Cache for 1 minute
    retry: 1,
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async (stageId: number | undefined) => {
      const response = await api.put(`/leads/${leadId}`, { stage_id: stageId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post('/notes', { lead_id: leadId, content });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      setNewNote('');
      setShowNoteForm(false);
    },
  });

  // Add reminder mutation
  const addReminderMutation = useMutation({
    mutationFn: async (data: { due_at: string; reason: string }) => {
      const response = await api.post('/reminders', { lead_id: leadId, ...data });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      setNewReminder({ due_at: '', reason: '' });
      setShowReminderForm(false);
    },
  });

  // Promo code mutations
  const assignPromoCodeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/promo-codes/assign', { lead_id: leadId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCode', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      console.error('Failed to assign promo code:', error);
      alert(error.response?.data?.error || 'Fehler beim Zuweisen des Codes');
    },
  });

  const unassignPromoCodeMutation = useMutation({
    mutationFn: async (codeId: number) => {
      const response = await api.post(`/promo-codes/${codeId}/unassign`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promoCode', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: any) => {
      console.error('Failed to unassign promo code:', error);
      alert(error.response?.data?.error || 'Fehler beim Aufheben der Zuweisung');
    },
  });

  // Advisory Board mutation
  const toggleAdvisoryBoardMutation = useMutation({
    mutationFn: async (isAdvisoryBoard: boolean) => {
      const response = await api.put(`/leads/${leadId}/advisory-board`, { is_advisory_board: isAdvisoryBoard });
      return response.data;
    },
    onSuccess: (data, isAdvisoryBoard) => {
      // Immediately update the cached lead data
      queryClient.setQueryData(['lead', leadId], (oldData: Lead | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, is_advisory_board: isAdvisoryBoard };
      });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // Tag mutations
  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await api.post(`/leads/${leadId}/tags`, { tag_id: tagId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await api.delete(`/leads/${leadId}/tags/${tagId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
  });

  const handlePrevious = () => {
    if (hasPrevious) {
      onNavigate(leadIds[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onNavigate(leadIds[currentIndex + 1]);
    }
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

  if (isLoading || !leadData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg p-8" onClick={(e) => e.stopPropagation()}>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  const stages: Stage[] = Array.isArray(stagesData?.stages) ? stagesData.stages : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 truncate">{leadData.name}</h2>
              {leadData.legal_form && (
                <p className="text-sm text-gray-600">{leadData.legal_form}</p>
              )}
            </div>
            {leadData.enrichment_data?.suitability_score && (
              <div className="flex items-center space-x-2 bg-amber-50 px-3 py-1 rounded-lg flex-shrink-0">
                <span className="text-xl">
                  {'⭐'.repeat(leadData.enrichment_data.suitability_score)}
                  {'☆'.repeat(5 - leadData.enrichment_data.suitability_score)}
                </span>
                <span className="text-sm font-semibold text-gray-700">
                  {leadData.enrichment_data.suitability_score}/5
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Navigation */}
            {leadIds.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  disabled={!hasPrevious}
                  className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Vorheriger Lead"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-500 px-2">
                  {currentIndex + 1} / {leadIds.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Nächster Lead"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-2" />
              </>
            )}

            {/* Open in full page */}
            <Link
              to={`/leads/${leadId}`}
              className="p-2 text-gray-600 hover:text-gray-900"
              title="Vollansicht öffnen"
            >
              <ExternalLink className="w-5 h-5" />
            </Link>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Quick Actions Row */}
                <div className="flex flex-wrap gap-3">
                  {leadData.phone && (
                    <a
                      href={`tel:${leadData.phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                      title={leadData.phone_verified ? `Verifiziert am ${leadData.phone_verified_at ? new Date(leadData.phone_verified_at).toLocaleDateString('de-DE') : ''}` : 'Nicht verifiziert'}
                    >
                      <Phone className="w-4 h-4" />
                      <span>{leadData.phone}</span>
                      {leadData.phone_verified && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </a>
                  )}
                  {leadData.email && (
                    <a
                      href={`mailto:${leadData.email}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      <span className="max-w-[200px] truncate">{leadData.email}</span>
                    </a>
                  )}
                  {leadData.website && (
                    <a
                      href={leadData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Website</span>
                    </a>
                  )}
                </div>

                {/* Stage Selector */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Stage</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(stages) && stages.map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => updateStageMutation.mutate(stage.id)}
                        disabled={updateStageMutation.isPending}
                        className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                          leadData.stage_id === stage.id
                            ? 'text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-400'
                        }`}
                        style={leadData.stage_id === stage.id ? { backgroundColor: stage.color } : undefined}
                      >
                        {stage.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Enrichment Data */}
                {leadData.enrichment_data && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Zusatzinfos</h3>

                    {leadData.enrichment_data.summary && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-800">{leadData.enrichment_data.summary}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {/* Services */}
                      {Array.isArray(leadData.enrichment_data.services) && leadData.enrichment_data.services.length > 0 && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Services</label>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {leadData.enrichment_data.services.slice(0, 5).map((service, idx) => (
                              <span key={idx} className="inline-flex px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Technologies */}
                      {Array.isArray(leadData.enrichment_data.technologies) && leadData.enrichment_data.technologies.length > 0 && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Technologien</label>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {leadData.enrichment_data.technologies.slice(0, 5).map((tech, idx) => (
                              <span key={idx} className="inline-flex px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Focus */}
                      {leadData.enrichment_data.focus && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Hauptfokus</label>
                          <p className="mt-1 text-sm text-gray-900">{leadData.enrichment_data.focus}</p>
                        </div>
                      )}

                      {/* Team Info */}
                      {leadData.enrichment_data.team_info && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Team</label>
                          <p className="mt-1 text-sm text-gray-900">{leadData.enrichment_data.team_info}</p>
                        </div>
                      )}
                    </div>

                    {/* Suitability Reasons */}
                    {Array.isArray(leadData.enrichment_data.suitability_reasons) && leadData.enrichment_data.suitability_reasons.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <label className="text-xs font-medium text-gray-700">Bewertung</label>
                        <ul className="mt-1 space-y-0.5">
                          {leadData.enrichment_data.suitability_reasons.map((reason, idx) => (
                            <li key={idx} className="text-xs text-gray-800">{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Company Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Standort
                    </h3>
                    <div className="text-sm text-gray-900 space-y-1">
                      {leadData.street && <p>{leadData.street}</p>}
                      <p>{leadData.zip} {leadData.city}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Unternehmen
                    </h3>
                    <div className="text-sm space-y-1">
                      {leadData.employee_count && (
                        <p className="text-gray-900"><span className="text-gray-600">Mitarbeiter:</span> {leadData.employee_count}</p>
                      )}
                      {leadData.nace_code && (
                        <p className="text-gray-900"><span className="text-gray-600">NACE:</span> {leadData.nace_code}</p>
                      )}
                      {(leadData.ceo_1 || leadData.ceo_2) && (
                        <p className="text-gray-900">
                          <span className="text-gray-600">GF:</span> {[leadData.ceo_1, leadData.ceo_2].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Business Purpose */}
                {leadData.business_purpose && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Unternehmenszweck</h3>
                    <p className="text-sm text-gray-700">{leadData.business_purpose}</p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Tags */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <TagIcon className="w-4 h-4" />
                    Tags
                  </h3>
                  
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addTagMutation.mutate(parseInt(e.target.value));
                        e.target.value = '';
                      }
                    }}
                    className="w-full mb-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    disabled={addTagMutation.isPending}
                  >
                    <option value="">+ Tag hinzufügen...</option>
                    {Array.isArray(allTagsData) && allTagsData
                      .filter(tag => !Array.isArray(leadData.tags) || !leadData.tags.some(lt => lt.id === tag.id))
                      .map((tag) => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                  </select>

                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(leadData.tags) && leadData.tags.length > 0 ? (
                      leadData.tags.map((tag: Tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                        >
                          {tag.name}
                          <button
                            onClick={() => removeTagMutation.mutate(tag.id)}
                            className="hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Keine Tags</p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Notizen
                    </h3>
                    <button
                      onClick={() => setShowNoteForm(!showNoteForm)}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {showNoteForm && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Notiz schreiben..."
                        rows={2}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => { setShowNoteForm(false); setNewNote(''); }}
                          className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={handleAddNote}
                          disabled={!newNote.trim() || addNoteMutation.isPending}
                          className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                        >
                          {addNoteMutation.isPending ? '...' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Array.isArray(leadData.notes) && leadData.notes.length > 0 ? (
                      leadData.notes.map((note: Note) => (
                        <div key={note.id} className="border-l-2 border-amber-500 pl-2 py-1">
                          <p className="text-xs text-gray-900">{note.content}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {note.user_name} • {new Date(note.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Keine Notizen</p>
                    )}
                  </div>
                </div>

                {/* Reminders */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Erinnerungen
                    </h3>
                    <button
                      onClick={() => setShowReminderForm(!showReminderForm)}
                      className="text-amber-600 hover:text-amber-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {showReminderForm && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg space-y-2">
                      <input
                        type="datetime-local"
                        value={newReminder.due_at}
                        onChange={(e) => setNewReminder({ ...newReminder, due_at: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Grund..."
                        value={newReminder.reason}
                        onChange={(e) => setNewReminder({ ...newReminder, reason: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setShowReminderForm(false); setNewReminder({ due_at: '', reason: '' }); }}
                          className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={handleAddReminder}
                          disabled={!newReminder.due_at || !newReminder.reason || addReminderMutation.isPending}
                          className="px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                        >
                          {addReminderMutation.isPending ? '...' : 'Speichern'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {Array.isArray(leadData.reminders) && leadData.reminders.length > 0 ? (
                      leadData.reminders.map((reminder: Reminder) => (
                        <div
                          key={reminder.id}
                          className={`p-2 rounded text-xs ${reminder.completed ? 'bg-gray-50' : 'bg-orange-50'}`}
                        >
                          <div className="flex items-start gap-1.5">
                            <Calendar className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-900">{reminder.reason}</p>
                              <p className="text-gray-500">
                                {new Date(reminder.due_at).toLocaleString('de-DE', { 
                                  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Keine Erinnerungen</p>
                    )}
                  </div>
                </div>

                {/* Assigned To */}
                {leadData.assigned_to_name && (
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Zugewiesen
                    </h3>
                    <p className="text-sm text-gray-700">{leadData.assigned_to_name}</p>
                  </div>
                )}

                {/* Promo Code */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    🎟️ Aktionscode
                  </h3>
                  {promoCodeData ? (
                    <>
                      <p className="text-lg font-mono font-bold text-gray-900 mb-2">
                        {promoCodeData.code}
                      </p>
                      <div className="space-y-1 mb-3">
                        <p className="text-sm text-gray-600">
                          ausgegeben: {promoCodeData.assigned_at ? new Date(promoCodeData.assigned_at).toLocaleDateString('de-DE') : '-'}
                        </p>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          Status: <span className="font-medium">
                            {workspaceStatusLoading ? (
                              <span className="text-gray-500">lädt...</span>
                            ) : workspaceStatus?.found && workspaceStatus.workspace?.rootUserHasLoggedIn ? (
                              <span className="text-green-600">Workspace Aktiv 🟢</span>
                            ) : workspaceStatus?.found && workspaceStatus.workspace ? (
                              <span className="text-yellow-600">Workspace erstellt 🟡</span>
                            ) : (
                              <span className="text-red-600">Warten 🔴</span>
                            )}
                          </span>
                        </p>
                      </div>

                      {/* Workspace Status Section */}
                      {workspaceStatusLoading ? (
                        <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200">
                          <p className="text-xs text-gray-500">Lade Workspace-Status...</p>
                        </div>
                      ) : workspaceStatus?.found && workspaceStatus.workspace ? (
                        <div className="mb-3 p-3 bg-green-50 rounded border border-green-200">
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
                        <div className="mb-3 p-3 bg-amber-50 rounded border border-amber-200">
                          <p className="text-sm text-amber-700 font-medium">❌ Noch kein Workspace</p>
                          <p className="text-xs text-amber-600 mt-1">Kunde hat Code noch nicht verwendet</p>
                        </div>
                      ) : null}

                      <button
                        onClick={handleCopyEmail}
                        className="w-full mb-2 px-3 py-1.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 rounded transition-colors flex items-center justify-center gap-2"
                      >
                        {emailCopied ? '✓ Kopiert' : '📋 Mail kopieren'}
                      </button>
                      {promoCodeData.status === 'assigned' && (
                        <button
                          onClick={() => {
                            if (confirm('Code-Zuweisung wirklich aufheben?')) {
                              unassignPromoCodeMutation.mutate(promoCodeData.id);
                            }
                          }}
                          disabled={unassignPromoCodeMutation.isPending}
                          className="w-full px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                        >
                          {unassignPromoCodeMutation.isPending ? 'Wird aufgehoben...' : 'Zuweisung aufheben'}
                        </button>
                      )}

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
                            className="w-full mt-3 px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                          >
                            📅 Termin buchen
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 mb-3">
                        Kein Code zugewiesen
                      </p>
                      <button
                        onClick={() => assignPromoCodeMutation.mutate()}
                        disabled={assignPromoCodeMutation.isPending}
                        className="w-full px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                      >
                        {assignPromoCodeMutation.isPending ? 'Wird zugewiesen...' : 'Code beantragen'}
                      </button>
                    </>
                  )}
                </div>

                {/* NorthData Link */}
                {leadData.northdata_url && (
                  <a
                    href={leadData.northdata_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    North Data öffnen →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <Link
            to={`/leads/${leadId}`}
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Vollansicht öffnen →
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
