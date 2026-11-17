/**
 * Server › Integrations › ADS-B, Elevation or MeshWars (board 13-27's
 * Services rows; s13n7): on phone each is a page of its own with the 13-11
 * fields, their own Save and Test. It works on desktop too.
 */
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdsbGroup, ElevationGroup, IntegrationsFrame, MeshWarsGroup } from './IntegrationsPage';

const SERVICES = {
  adsb: { title: ['settings.adsb_section', 'Flight matching (ADS-B)'], Group: AdsbGroup },
  elevation: { title: ['settings.elevation_section', 'Elevation / Terrain'], Group: ElevationGroup },
  meshwars: { title: ['settings.meshwars.title', 'MeshWars'], Group: MeshWarsGroup },
} as const;

export default function IntegrationPage() {
  const { t } = useTranslation();
  const service = SERVICES[useParams().service as keyof typeof SERVICES];
  if (!service) return <Navigate replace to="/server/integrations" />;
  const { Group } = service;
  return (
    <IntegrationsFrame title={t(service.title[0], service.title[1])} back={{ label: t('workspace.server.nav.integrations'), to: '/server/integrations' }}>
      <Group />
    </IntegrationsFrame>
  );
}
