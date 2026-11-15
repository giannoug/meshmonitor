/**
 * The audit log page's data, filters and export, moved out of AuditLogTab
 * (Rule X, #6365) so the Workspace Audit log reads the same endpoints with
 * the same filters. Behaviour is unchanged; AuditLogTab uses it.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { logger } from '../utils/logger';
import { useToast } from './ToastContainer';

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  resource: string | null;
  details: string | null;
  ipAddress: string | null;
  valueBefore: string | null;
  valueAfter: string | null;
  timestamp: number;
}

export interface AuditStats {
  actionStats: Array<{ action: string; count: number }>;
  userStats: Array<{ username: string | null; count: number }>;
  dailyStats: Array<{ date: string; count: number }>;
  totalEvents: number;
}

export interface AuditUser {
  id: number;
  username: string;
}

export function useAuditLog() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [users, setUsers] = useState<AuditUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    source: '',
    resource: '',
    search: '',
    startDate: '',
    endDate: '',
    sinceMs: 0,
    limit: 100,
    offset: 0
  });

  // sinceMs: Workspace's time presets (1 h / 24 h / 7 d), a window ending now. Classic never sets it.
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = filters.limit;

  useEffect(() => {
    void fetchLogs();
    void fetchStats();
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 moved verbatim from AuditLogTab: refetch on filter change only
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.source === 'ui') params.append('excludeAction', 'api_token_used');
      if (filters.source === 'api') params.append('action', 'api_token_used');
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) {
        const startTimestamp = new Date(filters.startDate).getTime();
        params.append('startDate', startTimestamp.toString());
      } else if (filters.sinceMs) {
        params.append('startDate', (Date.now() - filters.sinceMs).toString());
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        params.append('endDate', endDate.getTime().toString());
      }
      params.append('limit', filters.limit.toString());
      params.append('offset', filters.offset.toString());

      const response = await api.get<{ logs: AuditLogEntry[]; total: number }>(
        `/api/audit?${params.toString()}`
      );
      setLogs(response.logs);
      setTotal(response.total);
    } catch (err) {
      logger.error('Failed to fetch audit logs:', err);
      setError(t('audit.failed_load'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get<{ stats: AuditStats }>('/api/audit/stats/summary?days=30');
      setStats(response.stats);
    } catch (err) {
      logger.error('Failed to fetch audit stats:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get<{ users: AuditUser[] }>('/api/users');
      setUsers(response.users);
    } catch (err) {
      logger.error('Failed to fetch users:', err);
    }
  };

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: key !== 'offset' ? 0 : (typeof value === 'number' ? value : 0) // Reset to first page when filters change
    }));
    if (key !== 'offset') {
      setCurrentPage(1);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      userId: '',
      action: '',
      source: '',
      resource: '',
      search: '',
      startDate: '',
      endDate: '',
      sinceMs: 0,
      limit: 100,
      offset: 0
    });
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * itemsPerPage;
    setFilters(prev => ({ ...prev, offset: newOffset }));
    setCurrentPage(newPage);
  };

  const handleExportCSV = () => {
    try {
      const csvContent = [
        // Header
        ['Timestamp', 'User', 'Action', 'Resource', 'Details', 'IP Address'].join(','),
        // Data rows
        ...logs.map(log => {
          // PostgreSQL returns BIGINT as string, so ensure it's a number
          const ts = typeof log.timestamp === 'string' ? parseInt(log.timestamp, 10) : log.timestamp;
          const dateStr = (!ts || isNaN(ts)) ? 'Unknown' : new Date(ts).toISOString();
          return [
            dateStr,
            log.username || 'System',
            log.action,
            log.resource || '',
            (log.details || '').replace(/,/g, ';'), // Escape commas
            log.ipAddress || ''
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${new Date().toISOString()}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      showToast(t('audit.export_success'), 'success');
    } catch (err) {
      logger.error('Failed to export CSV:', err);
      showToast(t('audit.export_failed'), 'error');
    }
  };

  const formatTimestamp = (timestamp: number | string | null | undefined) => {
    if (timestamp === null || timestamp === undefined) {
      return t('common.unknown');
    }
    // PostgreSQL returns BIGINT as string, so ensure it's a number
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (isNaN(ts)) {
      return t('common.unknown');
    }
    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      return t('common.unknown');
    }
    return date.toLocaleString();
  };

  const getActionColor = (action: string): string => {
    if (action.includes('fail') || action.includes('delete') || action.includes('purge')) {
      return 'action-error';
    }
    if (action.includes('update') || action.includes('change') || action.includes('reset')) {
      return 'action-warning';
    }
    if (action.includes('success') || action.includes('create')) {
      return 'action-success';
    }
    return '';
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  // Unique actions and resources for dropdowns
  const uniqueActions = Array.from(new Set(stats?.actionStats.map(s => s.action) || []));
  const uniqueResources = ['auth', 'users', 'permissions', 'settings', 'nodes', 'messages', 'telemetry', 'connection', 'audit'];

  return {
    logs, stats, users, loading, error, total, filters, currentPage, itemsPerPage, totalPages,
    uniqueActions, uniqueResources,
    handleFilterChange, handleClearFilters, handlePageChange, handleExportCSV, formatTimestamp, getActionColor,
  };
}
