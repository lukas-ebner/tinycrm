import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import type { Lead } from '@/types/index';

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

  const { data: leadData, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const response = await api.get(`/leads/${leadId}`);
      return response.data.lead as Lead;
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

  if (isLoading || !leadData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg p-8" onClick={(e) => e.stopPropagation()}>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{leadData.name}</h2>
              {leadData.legal_form && (
                <p className="text-sm text-gray-600">{leadData.legal_form}</p>
              )}
            </div>
            {leadData.enrichment_data?.suitability_score && (
              <div className="flex items-center space-x-2 bg-amber-50 px-3 py-1 rounded-lg">
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

          <div className="flex items-center space-x-2">
            {/* Navigation */}
            {leadIds.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  disabled={!hasPrevious}
                  className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous lead"
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
                  title="Next lead"
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
              title="Open full page"
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

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Zusatzinfos (Enrichment Data) */}
          {leadData.enrichment_data && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Zusatzinfos</h3>

              {/* Summary */}
              {leadData.enrichment_data.summary && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-800">{leadData.enrichment_data.summary}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Services */}
                {leadData.enrichment_data.services && leadData.enrichment_data.services.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-700">Services & Leistungen</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {leadData.enrichment_data.services.slice(0, 5).map((service, idx) => (
                        <span key={idx} className="inline-flex px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          {service}
                        </span>
                      ))}
                      {leadData.enrichment_data.services.length > 5 && (
                        <span className="text-xs text-gray-500">+{leadData.enrichment_data.services.length - 5}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Technologies */}
                {leadData.enrichment_data.technologies && leadData.enrichment_data.technologies.length > 0 && (
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
                    <label className="text-xs font-medium text-gray-700">Team-Größe</label>
                    <p className="mt-1 text-sm text-gray-900">{leadData.enrichment_data.team_info}</p>
                  </div>
                )}

                {/* Company Age */}
                {leadData.enrichment_data.company_age && (
                  <div>
                    <label className="text-xs font-medium text-gray-700">Unternehmen</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {leadData.enrichment_data.company_age} Jahre alt
                      {leadData.enrichment_data.founding_year && ` (${leadData.enrichment_data.founding_year})`}
                    </p>
                  </div>
                )}
              </div>

              {/* Suitability Reasons */}
              {leadData.enrichment_data.suitability_reasons && leadData.enrichment_data.suitability_reasons.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="text-xs font-medium text-gray-700">Bewertung</label>
                  <ul className="mt-2 space-y-1">
                    {leadData.enrichment_data.suitability_reasons.map((reason, idx) => (
                      <li key={idx} className="text-xs text-gray-800">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Company Information */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact</h3>
              <div className="space-y-2 text-sm">
                {leadData.email && (
                  <div>
                    <span className="text-gray-600">Email:</span>{' '}
                    <a href={`mailto:${leadData.email}`} className="text-amber-600 hover:text-amber-700">
                      {leadData.email}
                    </a>
                  </div>
                )}
                {leadData.phone && (
                  <div>
                    <span className="text-gray-600">Phone:</span>{' '}
                    <a href={`tel:${leadData.phone}`} className="text-amber-600 hover:text-amber-700">
                      {leadData.phone}
                    </a>
                  </div>
                )}
                {leadData.website && (
                  <div>
                    <span className="text-gray-600">Website:</span>{' '}
                    <a href={leadData.website} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700">
                      {leadData.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Location</h3>
              <div className="space-y-2 text-sm">
                {leadData.street && <div className="text-gray-900">{leadData.street}</div>}
                {(leadData.zip || leadData.city) && (
                  <div className="text-gray-900">
                    {leadData.zip} {leadData.city}
                  </div>
                )}
                {leadData.employee_count && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Employees:</span> {leadData.employee_count}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stage & Assignment */}
          <div className="flex items-center justify-between">
            {leadData.stage_name && (
              <div>
                <label className="text-xs font-medium text-gray-700">Stage</label>
                <div className="mt-1">
                  <span
                    className="inline-flex px-3 py-1 text-sm font-semibold rounded-full text-white"
                    style={{ backgroundColor: leadData.stage_color || '#gray' }}
                  >
                    {leadData.stage_name}
                  </span>
                </div>
              </div>
            )}

            {leadData.assigned_to_name && (
              <div>
                <label className="text-xs font-medium text-gray-700">Assigned To</label>
                <div className="mt-1 text-sm text-gray-900">{leadData.assigned_to_name}</div>
              </div>
            )}
          </div>

          {/* Tags */}
          {leadData.tags && leadData.tags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-700">Tags</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {leadData.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <Link
            to={`/leads/${leadId}`}
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Open full details →
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
