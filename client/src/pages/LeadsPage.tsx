import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Plus, Save, Bookmark, Trash2, Users } from 'lucide-react';
import api from '@/lib/api';
import type { Lead, SavedFilter, User, Tag } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';

export default function LeadsPage() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [naceCodeFilter, setNaceCodeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [zipFilter, setZipFilter] = useState('');
  const [tagsFilter, setTagsFilter] = useState<string[]>([]);
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [selectedFilterForBulkAssign, setSelectedFilterForBulkAssign] = useState<SavedFilter | null>(null);
  const [bulkAssignUser, setBulkAssignUser] = useState('');
  const [newFilterName, setNewFilterName] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', search, stageFilter, assignedToFilter, naceCodeFilter, cityFilter, zipFilter, tagsFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (stageFilter) params.append('stage_id', stageFilter);
      if (assignedToFilter) params.append('assigned_to', assignedToFilter);
      if (naceCodeFilter) params.append('nace_code', naceCodeFilter);
      if (cityFilter) params.append('city', cityFilter);
      if (zipFilter) params.append('zip', zipFilter);
      if (tagsFilter.length > 0) params.append('tags', tagsFilter.join(','));
      const response = await api.get(`/leads?${params}`);
      return response.data;
    },
  });

  const { data: stagesData } = useQuery({
    queryKey: ['stages'],
    queryFn: async () => {
      const response = await api.get('/stages');
      return response.data;
    },
  });

  // Fetch all users for assigned_to filter (admin only)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data.users as User[];
    },
    enabled: user?.role === 'admin',
  });

  // Fetch all tags
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await api.get('/tags');
      return response.data.tags as Tag[];
    },
  });

  // Fetch saved filters
  const { data: savedFiltersData } = useQuery({
    queryKey: ['savedFilters'],
    queryFn: async () => {
      const response = await api.get('/saved-filters');
      return response.data.filters as SavedFilter[];
    },
  });

  // Create saved filter mutation
  const createFilterMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      search?: string;
      stage_id?: number;
      nace_code?: string;
      assigned_to?: number;
      tags?: string[];
      city?: string;
      zip?: string;
    }) => {
      const response = await api.post('/saved-filters', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedFilters'] });
      setShowSaveFilterModal(false);
      setNewFilterName('');
    },
  });

  // Delete saved filter mutation
  const deleteFilterMutation = useMutation({
    mutationFn: async (filterId: number) => {
      const response = await api.delete(`/saved-filters/${filterId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedFilters'] });
    },
  });

  // Bulk assign from filter mutation
  const bulkAssignFromFilterMutation = useMutation({
    mutationFn: async (data: { filter_id: number; assigned_to: number }) => {
      const response = await api.post('/leads/bulk-assign-filter', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowBulkAssignModal(false);
      setSelectedFilterForBulkAssign(null);
      setBulkAssignUser('');
      alert(`Successfully assigned ${data.updated} leads!`);
    },
    onError: (error: any) => {
      alert(`Error: ${error.response?.data?.error || 'Failed to assign leads'}`);
    },
  });

  const leads: Lead[] = leadsData?.leads || [];
  const stages = stagesData?.stages || [];
  const total = leadsData?.total || 0;
  const filtered = leadsData?.filtered || 0;

  // Save lead navigation context
  const handleLeadClick = (leadId: number) => {
    const leadIds = leads.map(l => l.id);
    sessionStorage.setItem('leadNavigationIds', JSON.stringify(leadIds));
    sessionStorage.setItem('leadNavigationSource', 'leads-list');
  };

  // Load a saved filter
  const handleLoadFilter = (filter: SavedFilter) => {
    setSearch(filter.search || '');
    setStageFilter(filter.stage_id?.toString() || '');
    setAssignedToFilter(filter.assigned_to?.toString() || '');
    setNaceCodeFilter(filter.nace_code || '');
    setCityFilter(filter.city || '');
    setZipFilter(filter.zip || '');
    setTagsFilter(filter.tags || []);
  };

  // Save current filter
  const handleSaveCurrentFilter = () => {
    if (newFilterName.trim()) {
      createFilterMutation.mutate({
        name: newFilterName,
        search: search || undefined,
        stage_id: stageFilter ? parseInt(stageFilter) : undefined,
        assigned_to: assignedToFilter ? parseInt(assignedToFilter) : undefined,
        nace_code: naceCodeFilter || undefined,
        city: cityFilter || undefined,
        zip: zipFilter || undefined,
        tags: tagsFilter.length > 0 ? tagsFilter : undefined,
      });
    }
  };

  // Toggle tag selection
  const handleTagToggle = (tagName: string) => {
    setTagsFilter(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  // Open bulk assign modal
  const handleOpenBulkAssign = (filter: SavedFilter) => {
    setSelectedFilterForBulkAssign(filter);
    setShowBulkAssignModal(true);
  };

  // Perform bulk assignment
  const handleBulkAssign = async () => {
    if (!selectedFilterForBulkAssign || !bulkAssignUser) {
      return;
    }

    // Fetch count first for confirmation
    const params = new URLSearchParams();
    if (selectedFilterForBulkAssign.search) params.append('search', selectedFilterForBulkAssign.search);
    if (selectedFilterForBulkAssign.stage_id) params.append('stage_id', selectedFilterForBulkAssign.stage_id.toString());
    if (selectedFilterForBulkAssign.assigned_to) params.append('assigned_to', selectedFilterForBulkAssign.assigned_to.toString());
    if (selectedFilterForBulkAssign.nace_code) params.append('nace_code', selectedFilterForBulkAssign.nace_code);
    if (selectedFilterForBulkAssign.city) params.append('city', selectedFilterForBulkAssign.city);
    if (selectedFilterForBulkAssign.zip) params.append('zip', selectedFilterForBulkAssign.zip);
    if (selectedFilterForBulkAssign.tags && selectedFilterForBulkAssign.tags.length > 0) {
      params.append('tags', selectedFilterForBulkAssign.tags.join(','));
    }

    try {
      const response = await api.get(`/leads?${params}`);
      const count = response.data.filtered;

      if (count > 1000) {
        if (!window.confirm(`WARNING: This will assign ${count} leads. This is a large operation. Are you sure you want to continue?`)) {
          return;
        }
      } else {
        if (!window.confirm(`This will assign ${count} leads to the selected user. Continue?`)) {
          return;
        }
      }

      bulkAssignFromFilterMutation.mutate({
        filter_id: selectedFilterForBulkAssign.id,
        assigned_to: parseInt(bulkAssignUser),
      });
    } catch (error) {
      console.error('Error fetching lead count:', error);
      alert('Error fetching lead count. Please try again.');
    }
  };

  // Delete a saved filter
  const handleDeleteFilter = (filterId: number, filterName: string) => {
    if (window.confirm(`Filter "${filterName}" wirklich löschen?`)) {
      deleteFilterMutation.mutate(filterId);
    }
  };

  const savedFilters = savedFiltersData || [];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filtered} of {total} leads
            {filtered !== total && ` (filtered)`}
          </p>
        </div>
        <button className="flex items-center space-x-2 bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700">
          <Plus className="w-4 h-4" />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Bookmark className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Saved Filters:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedFilters.map((filter) => (
              <div
                key={filter.id}
                className="inline-flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <button
                  onClick={() => handleLoadFilter(filter)}
                  className="text-gray-700 hover:text-amber-600 font-medium text-sm"
                >
                  {filter.name}
                </button>
                <div className="flex items-center space-x-1">
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleOpenBulkAssign(filter)}
                      className="p-1 hover:bg-amber-100 rounded text-amber-600"
                      title="Assign all matching leads"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFilter(filter.id, filter.name);
                    }}
                    className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
                    title="Delete filter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, city, or NACE code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-600"
              />
            </div>
          </div>

          {/* Stage */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-600"
            >
              <option value="">All Stages</option>
              {stages.map((stage: any) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned To (Admin only) */}
          {user?.role === 'admin' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
              <select
                value={assignedToFilter}
                onChange={(e) => setAssignedToFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-600"
              >
                <option value="">All Users</option>
                <option value="null">Unassigned</option>
                {usersData?.map((u: User) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* NACE Code */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">NACE Code</label>
            <input
              type="text"
              placeholder="e.g., 62.01"
              value={naceCodeFilter}
              onChange={(e) => setNaceCodeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-600"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">City (Ort)</label>
            <input
              type="text"
              placeholder="e.g., Berlin"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-600"
            />
          </div>

          {/* ZIP */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ZIP (PLZ)</label>
            <input
              type="text"
              placeholder="e.g., 10115"
              value={zipFilter}
              onChange={(e) => setZipFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-amber-500 focus:border-amber-600"
            />
          </div>
        </div>

        {/* Tags Multi-Select */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Tags (select multiple)</label>
          <div className="flex flex-wrap gap-2">
            {tagsData?.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleTagToggle(tag.name)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  tagsFilter.includes(tag.name)
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        {/* Save Filter Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowSaveFilterModal(true)}
            className="flex items-center space-x-2 px-4 py-2 border border-amber-600 text-amber-600 rounded-md hover:bg-amber-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Filter</span>
          </button>
        </div>
      </div>

      {/* Save Filter Modal */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Current Filter</h3>
            <input
              type="text"
              placeholder="Filter name (e.g. 'Berlin GmbH Leads')"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4"
              autoFocus
            />
            <div className="text-sm text-gray-600 mb-4">
              <strong>Current filters:</strong>
              <ul className="mt-2 space-y-1">
                {search && <li>• Search: "{search}"</li>}
                {stageFilter && (
                  <li>• Stage: {stages.find(s => s.id === parseInt(stageFilter))?.name}</li>
                )}
                {assignedToFilter && (
                  <li>• Assigned To: {usersData?.find(u => u.id === parseInt(assignedToFilter))?.name || 'Unassigned'}</li>
                )}
                {naceCodeFilter && <li>• NACE Code: {naceCodeFilter}</li>}
                {cityFilter && <li>• City: {cityFilter}</li>}
                {zipFilter && <li>• ZIP: {zipFilter}</li>}
                {tagsFilter.length > 0 && (
                  <li>• Tags: {tagsFilter.join(', ')}</li>
                )}
                {!search && !stageFilter && !assignedToFilter && !naceCodeFilter &&
                 !cityFilter && !zipFilter && tagsFilter.length === 0 && (
                  <li>• No filters active</li>
                )}
              </ul>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowSaveFilterModal(false);
                  setNewFilterName('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentFilter}
                disabled={!newFilterName.trim() || createFilterMutation.isPending}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                {createFilterMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Assign Modal */}
      {showBulkAssignModal && selectedFilterForBulkAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Bulk Assign: {selectedFilterForBulkAssign.name}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to User
              </label>
              <select
                value={bulkAssignUser}
                onChange={(e) => setBulkAssignUser(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select a user...</option>
                {usersData?.filter(u => u.active).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Warning:</strong> This will assign ALL leads matching this filter to the selected user.
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowBulkAssignModal(false);
                  setSelectedFilterForBulkAssign(null);
                  setBulkAssignUser('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkAssignUser || bulkAssignFromFilterMutation.isPending}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                {bulkAssignFromFilterMutation.isPending ? 'Assigning...' : 'Assign All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No leads found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/leads/${lead.id}`}
                        onClick={() => handleLeadClick(lead.id)}
                        className="text-amber-600 hover:text-amber-700 font-medium"
                      >
                        {lead.name}
                      </Link>
                      {lead.legal_form && (
                        <p className="text-sm text-gray-500">{lead.legal_form}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {lead.city && lead.zip && `${lead.zip} ${lead.city}`}
                    </td>
                    <td className="px-6 py-4">
                      {lead.stage_name && (
                        <span
                          className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white"
                          style={{ backgroundColor: lead.stage_color || '#gray' }}
                        >
                          {lead.stage_name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {lead.assigned_to_name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags?.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
