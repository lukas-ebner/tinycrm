import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bookmark, X } from 'lucide-react';
import api from '@/lib/api';
import type { Lead, Stage, SavedFilter } from '@/types/index';
import LeadDetailModal from '@/components/LeadDetailModal';

export default function KanbanPage() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<SavedFilter | null>(null);
  const [scoreFilter, setScoreFilter] = useState('');
  const [importSourceFilter, setImportSourceFilter] = useState('');
  const [tagsFilter, setTagsFilter] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState('');
  const [naceCodeFilter, setNaceCodeFilter] = useState('');
  const [zipFilter, setZipFilter] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [modalLeadIds, setModalLeadIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Update reminder stages on page load
  useEffect(() => {
    const updateStages = async () => {
      try {
        await api.post('/reminders/update-stages');
        // Refresh leads after updating stages
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      } catch (error) {
        console.error('Failed to update reminder stages:', error);
      }
    };
    updateStages();
  }, [queryClient]);

  // Fetch leads with filters
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', search, scoreFilter, importSourceFilter, tagsFilter, cityFilter, naceCodeFilter, zipFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (scoreFilter) params.append('min_score', scoreFilter);
      if (importSourceFilter) params.append('import_source', importSourceFilter);
      if (tagsFilter.length > 0) params.append('tags', tagsFilter.join(','));
      if (cityFilter) params.append('city', cityFilter);
      if (naceCodeFilter) params.append('nace_code', naceCodeFilter);
      if (zipFilter) params.append('zip', zipFilter);
      const response = await api.get(`/leads?${params}`);

      // Parse JSON strings for each lead (PostgreSQL JSONB edge case)
      if (response.data.leads && Array.isArray(response.data.leads)) {
        response.data.leads = response.data.leads.map((lead: Lead) => {
          // Parse enrichment_data if it's a string
          if (lead.enrichment_data && typeof lead.enrichment_data === 'string') {
            try {
              lead.enrichment_data = JSON.parse(lead.enrichment_data);
            } catch (e) {
              lead.enrichment_data = undefined;
            }
          }
          // Parse tags if it's a string
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
          return lead;
        });
      }

      return response.data;
    },
  });

  // Fetch stages
  const { data: stagesData, isLoading: stagesLoading } = useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      const response = await api.get('/stages');
      return response.data;
    },
  });

  // Fetch saved filters
  const { data: savedFiltersData } = useQuery({
    queryKey: ['savedFilters'],
    queryFn: async () => {
      const response = await api.get('/saved-filters');
      const filters = response.data.filters;
      return Array.isArray(filters) ? filters as SavedFilter[] : [];
    },
  });

  // Update lead stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: number; stageId: number }) => {
      const response = await api.put(`/leads/${leadId}`, { stage_id: stageId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const leads: Lead[] = Array.isArray(leadsData?.leads) ? leadsData.leads : [];
  const stages: Stage[] = Array.isArray(stagesData?.stages) ? stagesData.stages : [];
  const savedFilters: SavedFilter[] = Array.isArray(savedFiltersData) ? savedFiltersData : [];

  // Load a saved filter
  const handleLoadFilter = (filter: SavedFilter) => {
    setActiveFilter(filter);
    setSearch(filter.search || '');
    setScoreFilter(filter.min_score?.toString() || '');
    setImportSourceFilter(filter.import_source || '');
    setTagsFilter(filter.tags || []);
    setCityFilter(filter.city || '');
    setNaceCodeFilter(filter.nace_code || '');
    setZipFilter(filter.zip || '');
  };

  // Clear active filter
  const handleClearFilter = () => {
    setActiveFilter(null);
    setSearch('');
    setScoreFilter('');
    setImportSourceFilter('');
    setTagsFilter([]);
    setCityFilter('');
    setNaceCodeFilter('');
    setZipFilter('');
  };

  // Group leads by stage
  const leadsByStage = Array.isArray(stages) && Array.isArray(leads)
    ? stages.reduce((acc, stage) => {
        acc[stage.id] = leads.filter((lead) => lead.stage_id === stage.id);
        return acc;
      }, {} as Record<number, Lead[]>)
    : {};

  // Unassigned leads (no stage)
  const unassignedLeads = Array.isArray(leads) ? leads.filter((lead) => !lead.stage_id) : [];

  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    e.dataTransfer.setData('leadId', leadId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    const leadId = parseInt(e.dataTransfer.getData('leadId'));
    if (leadId) {
      updateStageMutation.mutate({ leadId, stageId });
    }
  };

  // Handle lead click - open modal
  const handleLeadClick = (leadId: number, stageId: number | null) => {
    let stageLeadIds: number[];
    if (stageId === null || stageId === 0) {
      // Unassigned leads
      stageLeadIds = Array.isArray(unassignedLeads) ? unassignedLeads.map(l => l.id) : [];
    } else {
      const stageLeads = leadsByStage[stageId];
      stageLeadIds = Array.isArray(stageLeads) ? stageLeads.map(l => l.id) : [];
    }
    setModalLeadIds(stageLeadIds.length > 0 ? stageLeadIds : [leadId]);
    setSelectedLeadId(leadId);
  };

  // Handle stage header click - open first lead
  const handleStageHeaderClick = (stageId: number) => {
    const stageLeads = leadsByStage[stageId];
    if (Array.isArray(stageLeads) && stageLeads.length > 0) {
      const leadIds = stageLeads.map(l => l.id);
      setModalLeadIds(leadIds);
      setSelectedLeadId(stageLeads[0].id);
    }
  };

  if (leadsLoading || stagesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kanban Board</h1>
          <p className="text-sm text-gray-500 mt-1">
            {leads.length} Leads angezeigt
            {activeFilter && <span className="text-amber-600"> • Filter: {activeFilter.name}</span>}
          </p>
        </div>
      </div>

      {/* Saved Filters */}
      {Array.isArray(savedFilters) && savedFilters.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Bookmark className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleLoadFilter(filter)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeFilter?.id === filter.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.name}
              </button>
            ))}
            {activeFilter && (
              <button
                onClick={handleClearFilter}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Leads suchen..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveFilter(null); // Clear active filter indicator when manually searching
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-primary"
          />
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex space-x-4 h-full pb-4">
          {Array.isArray(stages) && stages.map((stage) => (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80 bg-gray-100 rounded-lg p-4 flex flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className="mb-4">
                <button
                  className="w-full flex items-center justify-between cursor-pointer hover:bg-gray-200 rounded p-2 text-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStageHeaderClick(stage.id);
                  }}
                  type="button"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h2 className="font-semibold text-gray-900">{stage.name}</h2>
                  </div>
                  <span className="text-sm text-gray-500">
                    {leadsByStage[stage.id]?.length || 0}
                  </span>
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {Array.isArray(leadsByStage[stage.id]) && leadsByStage[stage.id].map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleLeadClick(lead.id, stage.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 hover:text-amber-600">
                        {lead.name}
                      </h3>
                      {lead.enrichment_data?.suitability_score && (
                        <span className="text-sm ml-2 flex-shrink-0">
                          {'⭐'.repeat(lead.enrichment_data.suitability_score)}
                        </span>
                      )}
                    </div>

                    {lead.legal_form && (
                      <p className="text-sm text-gray-500 mb-2">{lead.legal_form}</p>
                    )}

                    {(lead.city || lead.zip) && (
                      <p className="text-sm text-gray-600">
                        {lead.zip} {lead.city}
                      </p>
                    )}

                    {lead.assigned_to_name && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-500">
                          Assigned to: {lead.assigned_to_name}
                        </p>
                      </div>
                    )}

                    {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {lead.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {(!leadsByStage[stage.id] || leadsByStage[stage.id].length === 0) && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Keine Leads in dieser Stage
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Unassigned Column */}
          {Array.isArray(unassignedLeads) && unassignedLeads.length > 0 && (
            <div className="flex-shrink-0 w-80 bg-gray-100 rounded-lg p-4 flex flex-col">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Nicht zugewiesen</h2>
                  <span className="text-sm text-gray-500">{unassignedLeads.length}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {unassignedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleLeadClick(lead.id, null)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 hover:text-amber-600">
                        {lead.name}
                      </h3>
                      {lead.enrichment_data?.suitability_score && (
                        <span className="text-sm ml-2 flex-shrink-0">
                          {'⭐'.repeat(lead.enrichment_data.suitability_score)}
                        </span>
                      )}
                    </div>

                    {lead.legal_form && (
                      <p className="text-sm text-gray-500 mb-2">{lead.legal_form}</p>
                    )}

                    {(lead.city || lead.zip) && (
                      <p className="text-sm text-gray-600">
                        {lead.zip} {lead.city}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {updateStageMutation.isPending && (
        <div className="fixed bottom-4 right-4 bg-amber-600 text-white px-4 py-2 rounded-lg shadow-lg">
          Stage wird aktualisiert...
        </div>
      )}

      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          leadIds={modalLeadIds}
          onClose={() => {
            setSelectedLeadId(null);
            setModalLeadIds([]);
          }}
          onNavigate={(newLeadId) => setSelectedLeadId(newLeadId)}
        />
      )}
    </div>
  );
}
