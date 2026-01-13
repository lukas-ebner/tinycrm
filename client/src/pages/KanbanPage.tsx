import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import api from '@/lib/api';
import type { Lead, Stage } from '@/types/index';

export default function KanbanPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  // Fetch leads
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const response = await api.get(`/leads?${params}`);
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

  const leads: Lead[] = leadsData?.leads || [];
  const stages: Stage[] = stagesData?.stages || [];

  // Group leads by stage
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = leads.filter((lead) => lead.stage_id === stage.id);
    return acc;
  }, {} as Record<number, Lead[]>);

  // Unassigned leads (no stage)
  const unassignedLeads = leads.filter((lead) => !lead.stage_id);

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

  // Handle lead click - save navigation context
  const handleLeadClick = (lead: Lead, stageId: number) => {
    const stageLeadIds = leadsByStage[stageId]?.map(l => l.id) || [];
    sessionStorage.setItem('leadNavigationIds', JSON.stringify(stageLeadIds));
    sessionStorage.setItem('leadNavigationSource', `kanban-stage-${stageId}`);
  };

  // Handle stage header click - navigate to first lead
  const handleStageHeaderClick = (stageId: number) => {
    const stageLeads = leadsByStage[stageId];
    if (stageLeads && stageLeads.length > 0) {
      const leadIds = stageLeads.map(l => l.id);
      sessionStorage.setItem('leadNavigationIds', JSON.stringify(leadIds));
      sessionStorage.setItem('leadNavigationSource', `kanban-stage-${stageId}`);
      navigate(`/leads/${stageLeads[0].id}`);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Kanban Board</h1>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-primary"
          />
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex space-x-4 h-full pb-4">
          {stages.map((stage) => (
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
                {leadsByStage[stage.id]?.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-move"
                  >
                    <Link
                      to={`/leads/${lead.id}`}
                      className="block"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeadClick(lead, stage.id);
                      }}
                    >
                      <h3 className="font-medium text-gray-900 hover:text-amber-600 mb-1">
                        {lead.name}
                      </h3>
                    </Link>

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

                    {lead.tags && lead.tags.length > 0 && (
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
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Unassigned Column */}
          {unassignedLeads.length > 0 && (
            <div className="flex-shrink-0 w-80 bg-gray-100 rounded-lg p-4 flex flex-col">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Unassigned</h2>
                  <span className="text-sm text-gray-500">{unassignedLeads.length}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {unassignedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-move"
                  >
                    <Link
                      to={`/leads/${lead.id}`}
                      className="block"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeadClick(lead, 0);
                      }}
                    >
                      <h3 className="font-medium text-gray-900 hover:text-amber-600 mb-1">
                        {lead.name}
                      </h3>
                    </Link>

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
          Updating stage...
        </div>
      )}
    </div>
  );
}
