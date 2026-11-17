/**
 * The frame of a Server page (Task 6.4): You's page frame with the scope
 * line (PrefsFrame), "Server" as the phone's way back, and the page's gate
 * (s13n2). A direct link to a page the user cannot open shows today's
 * no-permission state and reads nothing.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { UiIconName } from '../../components/icons';
import StateView from '../patterns/StateView';
import YouPageFrame from '../you/YouPageFrame';
import PrefsFrame from '../you/preferences/PrefsFrame';
import { useServerAccess, type ServerGate } from './serverEntries';

export interface ServerFrameProps {
  categoryId: string;
  title: string;
  scope: string;
  icon: UiIconName;
  gate: ServerGate;
  /** Wait for `GET /api/settings` before the rows show. Default true. */
  needsSettings?: boolean;
  /** Override the settings:write View only gate. */
  readOnly?: boolean;
  /** Phone: the way back; default the Server list. */
  back?: { label: string; to: string };
  crumb?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function ServerFrame({ gate, back, ...props }: ServerFrameProps) {
  const { t } = useTranslation();
  const { ready, allows } = useServerAccess();
  const way = back ?? { label: t('workspace.server.title'), to: '/server' };
  if (!ready || !allows(gate)) {
    return (
      <YouPageFrame title={props.title} back={way}>
        <StateView kind={ready ? 'noPermission' : 'loading'} />
      </YouPageFrame>
    );
  }
  return <PrefsFrame {...props} back={way} />;
}
