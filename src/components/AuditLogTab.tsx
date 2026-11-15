/**
 * Audit Log Tab Component
 *
 * Admin-only interface for viewing and filtering audit logs
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/audit.css';
import { useAuth } from '../contexts/AuthContext';
import { useAuditLog } from './useAuditLog';
import { MeshCoreCliActivity } from './MeshCore/MeshCoreCliActivity';
import tabStyles from './AuditLogTab.module.css';

const AuditLogTab: React.FC = () => {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  // #5892: the page also hosts the MeshCore CLI activity view.
  const [view, setView] = useState<'events' | 'cli'>('events');

  const toggleExpand = (logId: number) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const {
    logs, stats, users, loading, error, total, filters, currentPage, itemsPerPage, totalPages,
    uniqueActions, uniqueResources,
    handleFilterChange, handleClearFilters, handlePageChange, handleExportCSV, formatTimestamp, getActionColor,
  } = useAuditLog();

  if (!authStatus?.permissions?.global?.audit?.read) {
    return (
      <div className="audit-log-tab">
        <div className="error-message">
          {t('audit.no_permission')}
        </div>
      </div>
    );
  }

  const viewTabs = (
    <div className={tabStyles.tabs} role="tablist" aria-label={t('audit.views', 'Audit views')}>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'events'}
        className={view === 'events' ? `${tabStyles.tab} ${tabStyles.active}` : tabStyles.tab}
        onClick={() => setView('events')}
      >
        {t('audit.view_events', 'Audit events')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'cli'}
        className={view === 'cli' ? `${tabStyles.tab} ${tabStyles.active}` : tabStyles.tab}
        onClick={() => setView('cli')}
      >
        {t('audit.view_meshcore_cli', 'MeshCore CLI activity')}
      </button>
    </div>
  );

  if (view === 'cli') {
    return (
      <div className="audit-log-tab">
        <div className="audit-log-header">
          <h2>{t('audit.title')}</h2>
        </div>
        {viewTabs}
        <MeshCoreCliActivity />
      </div>
    );
  }

  return (
    <div className="audit-log-tab">
      <div className="audit-log-header">
        <h2>{t('audit.title')}</h2>
        <button
          onClick={handleExportCSV}
          className="button button-primary"
          disabled={!logs || logs.length === 0}
        >
          {t('audit.export_csv')}
        </button>
      </div>
      {viewTabs}

      {/* Statistics Summary */}
      {stats && (
        <div className="audit-stats">
          <div className="stat-card">
            <h3>{t('audit.total_events_30_days')}</h3>
            <p className="stat-value">{stats.totalEvents}</p>
          </div>
          <div className="stat-card">
            <h3>{t('audit.top_action')}</h3>
            <p className="stat-label">
              {stats.actionStats[0]?.action || t('audit.na')} ({stats.actionStats[0]?.count || 0})
            </p>
          </div>
          <div className="stat-card">
            <h3>{t('audit.most_active_user')}</h3>
            <p className="stat-label">
              {stats.userStats[0]?.username || t('audit.na')} ({stats.userStats[0]?.count || 0})
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="audit-filters">
        <h3>{t('audit.filters')}</h3>
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="filter-user">{t('audit.user')}</label>
            <select
              id="filter-user"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
            >
              <option value="">{t('audit.all_users')}</option>
              {users && users.map(user => (
                <option key={user.id} value={user.id}>{user.username}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="filter-source">{t('audit.source')}</label>
            <select
              id="filter-source"
              value={filters.source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
            >
              <option value="">{t('audit.all_sources')}</option>
              <option value="ui">{t('audit.ui_only')}</option>
              <option value="api">{t('audit.api_only')}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="filter-action">{t('audit.action')}</label>
            <select
              id="filter-action"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">{t('audit.all_actions')}</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="filter-resource">{t('audit.resource')}</label>
            <select
              id="filter-resource"
              value={filters.resource}
              onChange={(e) => handleFilterChange('resource', e.target.value)}
            >
              <option value="">{t('audit.all_resources')}</option>
              {uniqueResources.map(resource => (
                <option key={resource} value={resource}>{resource}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="filter-start-date">{t('audit.start_date')}</label>
            <input
              id="filter-start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="filter-end-date">{t('audit.end_date')}</label>
            <input
              id="filter-end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="filter-search">{t('audit.search')}</label>
            <input
              id="filter-search"
              type="text"
              placeholder={t('audit.search_placeholder')}
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button
            onClick={handleClearFilters}
            className="button button-secondary"
          >
            {t('audit.clear_filters')}
          </button>
          <div className="form-group inline-group">
            <label>{t('audit.per_page')}</label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div className="audit-loading">{t('audit.loading')}</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : !logs || logs.length === 0 ? (
        <div className="audit-empty">{t('audit.no_entries')}</div>
      ) : (
        <>
          <div className="audit-table-container">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>{t('audit.timestamp')}</th>
                  <th>{t('audit.user')}</th>
                  <th>{t('audit.action')}</th>
                  <th>{t('audit.resource')}</th>
                  <th>{t('audit.ip_address')}</th>
                  <th>{t('audit.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr className="audit-row" onClick={() => toggleExpand(log.id)}>
                      <td className="timestamp-cell">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td>
                        {log.username || <span className="system-label">{t('audit.system')}</span>}
                      </td>
                      <td className={`action-cell ${getActionColor(log.action)}`}>
                        {log.action}
                      </td>
                      <td>
                        {log.resource || '-'}
                      </td>
                      <td>
                        {log.ipAddress || '-'}
                      </td>
                      <td>
                        <div className="details-cell">
                          {log.details || '-'}
                        </div>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="audit-detail-row">
                        <td colSpan={6}>
                          <div className="audit-details">
                            <div className="detail-section">
                              <strong>{t('audit.details')}:</strong>
                              <pre className="detail-pre">
                                {log.details ? (() => {
                                  try {
                                    return JSON.stringify(JSON.parse(log.details), null, 2);
                                  } catch {
                                    return log.details;
                                  }
                                })() : t('audit.na')}
                              </pre>
                            </div>
                            {(log.valueBefore || log.valueAfter) && (
                              <div className="detail-comparison">
                                {log.valueBefore && (
                                  <div className="detail-section before">
                                    <strong>{t('audit.value_before')}</strong>
                                    <pre className="detail-pre">
                                      {(() => {
                                        try {
                                          return JSON.stringify(JSON.parse(log.valueBefore), null, 2);
                                        } catch {
                                          return log.valueBefore;
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                )}
                                {log.valueAfter && (
                                  <div className="detail-section after">
                                    <strong>{t('audit.value_after')}</strong>
                                    <pre className="detail-pre">
                                      {(() => {
                                        try {
                                          return JSON.stringify(JSON.parse(log.valueAfter), null, 2);
                                        } catch {
                                          return log.valueAfter;
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="audit-pagination">
              <div className="pagination-info">
                {t('audit.showing', { start: filters.offset + 1, end: Math.min(filters.offset + itemsPerPage, total), total })}
              </div>
              <div className="pagination-controls">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="button"
                >
                  {t('audit.previous')}
                </button>
                <span className="page-indicator">
                  {t('audit.page', { current: currentPage, total: totalPages })}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="button"
                >
                  {t('audit.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLogTab;
