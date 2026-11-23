/**
 * `/source/:id/security[/quiet]` for a Meshtastic-family device (Task 8.5):
 * the Security page under the providers it reads (the source, for scoped
 * permissions; the settings, for the time format). A MeshCore device's
 * Security runs inside MeshCoreScreen instead.
 */
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { appBasename } from '../../init';
import SecurityPage from './SecurityPage';

export default function DeviceSecurity({ sourceId, source, quiet }: { sourceId: string; source: DashboardSource; quiet: boolean }) {
  return (
    <SourceProvider sourceId={sourceId} sourceName={source.name} sourceType={source.type}>
      <SettingsProvider baseUrl={appBasename}>
        <SecurityPage sourceId={sourceId} deviceName={source.name} sourceType={source.type} quiet={quiet} />
      </SettingsProvider>
    </SourceProvider>
  );
}
