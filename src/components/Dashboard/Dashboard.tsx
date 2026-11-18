import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { arrayMove } from '@dnd-kit/sortable';
import { DragEndEvent } from '@dnd-kit/core';
import '../Dashboard.css';
import { logger } from '../../utils/logger';
import { useCsrfFetch } from '../../hooks/useCsrfFetch';
import { useSolarEstimatesLatest } from '../../hooks/useTelemetry';
import AddWidgetModal from '../AddWidgetModal';
import { DashboardHeader, DashboardFilters, DashboardGrid } from './components';
import { useDashboardData, useDashboardFilters, useCustomWidgets } from './hooks';
import { useChartSettings, useGlobalTimeRange } from './hooks/useChartSettings';
import { type DashboardProps } from './types';
import { meshtasticDashboardSource } from './dataSources';
import { useSettings } from '../../contexts/SettingsContext';
import { useSource } from '../../contexts/SourceContext';
import { SourceNotConnectedNotice } from '../common/SourceNotConnectedNotice';

const Dashboard: React.FC<DashboardProps> = React.memo(
  ({
    temperatureUnit = 'C',
    telemetryHours: _telemetryHours = 24,
    favoriteTelemetryStorageDays = 7,
    baseUrl,
    currentNodeId = null,
    canEdit = true,
    onOpenNodeDetails,
    dataSource = meshtasticDashboardSource,
  }) => {
    const { t } = useTranslation();
    const csrfFetch = useCsrfFetch();
    const { solarMonitoringEnabled, preferredDashboardSortOption, distanceUnit } = useSettings();
    const { sourceId } = useSource();
    const sourceQuery = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';

    // Modal state
    const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);

    // Data fetching hook
    const {
      favorites,
      setFavorites,
      customOrder,
      setCustomOrder,
      nodes,
      customWidgets,
      setCustomWidgets,
      solarVisibility,
      setSolarVisibility,
      chartYRanges,
      setChartYRanges,
      loading,
      error,
      notConnected,
    } = useDashboardData({ dataSource });

    const { getSolarVisibility, handleToggleSolar, getYRange, handleYRangeChange } = useChartSettings({
      baseUrl,
      dataSource,
      solarVisibility,
      setSolarVisibility,
      chartYRanges,
      setChartYRanges,
    });

    // Filters hook
    const {
      searchQuery,
      setSearchQuery,
      selectedNode,
      setSelectedNode,
      selectedType,
      setSelectedType,
      selectedRoles,
      sortOption,
      setSortOption,
      daysToView,
      setDaysToView,
      roleDropdownOpen,
      handleToggleRoleDropdown,
      handleClearRoleFilter,
      handleToggleRole,
      filteredAndSortedFavorites,
      uniqueNodes,
      uniqueTelemetryTypes,
      uniqueDeviceRoles,
    } = useDashboardFilters({
      favorites,
      nodes,
      customOrder,
      favoriteTelemetryStorageDays,
      defaultSortOption: preferredDashboardSortOption,
      dataSource,
    });

    // Widgets hook
    const { addWidget, removeWidget, addNodeToWidget, removeNodeFromWidget, selectTracerouteNode, updateWidgetConfig } = useCustomWidgets({
      baseUrl,
      customWidgets,
      setCustomWidgets,
    });

    // Fetch solar estimates using TanStack Query hook
    const { data: solarEstimates } = useSolarEstimatesLatest({
      baseUrl,
      limit: 500,
      enabled: true,
    });

    const { handleDataLoaded, forgetChart, globalTimeRange, globalMinTime } = useGlobalTimeRange();

    // Handle drag end
    const handleDragEnd = useCallback(
      async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
          const oldIndex = filteredAndSortedFavorites.findIndex(f => `${f.nodeId}-${f.telemetryType}` === active.id);
          const newIndex = filteredAndSortedFavorites.findIndex(f => `${f.nodeId}-${f.telemetryType}` === over.id);

          const newOrder = arrayMove(filteredAndSortedFavorites, oldIndex, newIndex);
          const newCustomOrder = newOrder.map(f => `${f.nodeId}-${f.telemetryType}`);

          setCustomOrder(newCustomOrder);
          setSortOption('custom');

          // Save to Local Storage
          try {
            localStorage.setItem('telemetryCustomOrder', JSON.stringify(newCustomOrder));
          } catch (err) {
            logger.error('Error saving custom order to Local Storage:', err);
          }

          // Save to server
          try {
            await csrfFetch(`${baseUrl}/api/settings${sourceQuery}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ telemetryCustomOrder: JSON.stringify(newCustomOrder) }),
            });
          } catch (err) {
            logger.error('Error saving custom order:', err);
          }
        }
      },
      [filteredAndSortedFavorites, setCustomOrder, setSortOption, csrfFetch, baseUrl, sourceQuery]
    );

    // Remove favorite
    const removeFavorite = useCallback(
      async (nodeId: string, telemetryType: string) => {
        try {
          const newFavorites = favorites.filter(f => !(f.nodeId === nodeId && f.telemetryType === telemetryType));

          // Update local state
          setFavorites(newFavorites);

          // Remove from telemetry data map
          forgetChart(`${nodeId}-${telemetryType}`);

          // Save to server
          await csrfFetch(`${baseUrl}/api/settings${sourceQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telemetryFavorites: JSON.stringify(newFavorites) }),
          });
        } catch (err) {
          logger.error('Error removing favorite:', err);
          // Revert on error
          window.location.reload();
        }
      },
      [favorites, setFavorites, forgetChart, baseUrl, csrfFetch, sourceQuery]
    );

    if (loading) {
      return <div className="dashboard-loading">{t('dashboard.loading')}</div>;
    }

    if (notConnected) {
      return <SourceNotConnectedNotice />;
    }

    if (error) {
      return <div className="dashboard-error">{t('dashboard.error', { error })}</div>;
    }

    const hours = daysToView * 24;
    const hasContent = favorites.length > 0 || customWidgets.length > 0;

    return (
      <div className="dashboard">
        <DashboardHeader
          favoritesCount={favorites.length}
          daysToView={daysToView}
          onAddWidgetClick={() => setShowAddWidgetModal(true)}
          showAddWidget={dataSource.widgets.supported.size > 0}
        />

        {dataSource.widgets.supported.size > 0 && (
          <AddWidgetModal
            supported={dataSource.widgets.supported}
            isOpen={showAddWidgetModal}
            onClose={() => setShowAddWidgetModal(false)}
            onAddWidget={addWidget}
          />
        )}

        <DashboardFilters
          daysToView={daysToView}
          maxDays={favoriteTelemetryStorageDays}
          onDaysToViewChange={setDaysToView}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedNode={selectedNode}
          onNodeChange={setSelectedNode}
          uniqueNodes={uniqueNodes}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          uniqueTypes={uniqueTelemetryTypes}
          selectedRoles={selectedRoles}
          uniqueRoles={uniqueDeviceRoles}
          roleDropdownOpen={roleDropdownOpen}
          onToggleRoleDropdown={handleToggleRoleDropdown}
          onClearRoleFilter={handleClearRoleFilter}
          onToggleRole={handleToggleRole}
          sortOption={sortOption}
          onSortChange={setSortOption}
        />

        {hasContent && (
          <DashboardGrid
            customWidgets={customWidgets}
            onRemoveWidget={removeWidget}
            onAddNodeToWidget={addNodeToWidget}
            onRemoveNodeFromWidget={removeNodeFromWidget}
            onSelectTracerouteNode={selectTracerouteNode}
            onOpenNodeDetails={onOpenNodeDetails}
            onUpdateWidgetConfig={updateWidgetConfig}
            distanceUnit={distanceUnit}
            favorites={filteredAndSortedFavorites}
            nodes={nodes}
            currentNodeId={currentNodeId}
            temperatureUnit={temperatureUnit}
            hours={hours}
            baseUrl={baseUrl}
            globalTimeRange={globalTimeRange}
            globalMinTime={globalMinTime}
            solarEstimates={solarEstimates || new Map()}
            onRemoveFavorite={removeFavorite}
            onDataLoaded={handleDataLoaded}
            onDragEnd={handleDragEnd}
            widgetsCount={customWidgets.length}
            favoritesCount={favorites.length}
            filteredCount={filteredAndSortedFavorites.length}
            canEdit={canEdit}
            sourceKind={dataSource.kind}
            voltageFallback={dataSource.widgets.voltageFallback}
            solarMonitoringEnabled={solarMonitoringEnabled}
            getSolarVisibility={getSolarVisibility}
            onToggleSolar={handleToggleSolar}
            getYRange={getYRange}
            onYRangeChange={handleYRangeChange}
          />
        )}

        {!hasContent && (
          <div className="dashboard-empty">
            <h2>{t('dashboard.empty_title')}</h2>
            <p>{t('dashboard.empty_description')}</p>
          </div>
        )}
      </div>
    );
  }
);

Dashboard.displayName = 'Dashboard';

export default Dashboard;
