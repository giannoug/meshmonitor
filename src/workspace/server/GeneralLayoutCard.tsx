/**
 * Server › General, Layout and Sources cards (board r4-server-general; spec
 * §5.1, §7.2–7.3). Admins only, like the settings it writes:
 *
 * - Default layout for new users: `defaultLayout` (a user's own `layout`
 *   preference still wins).
 * - Offer Workspace to Classic users: `offerWorkspaceBanner` (the r3 banner).
 * - Who uses which: `GET /api/admin/layout-usage`.
 * - Default Meshtastic source: today's `defaultMeshtasticSourceId`, with
 *   today's label and options (the board's "Default device for guests"
 *   describes a different setting; D9b, Ruling V).
 *
 * Each control saves as it changes (`POST /api/settings`) and shows a Saved
 * tick once the server has it; a failed save leaves the old value and says so. The rest of General stays
 * re-hosted below until Task 6.4.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ToastContainer';
import { UiIcon } from '../../components/icons';
import { useDashboardSources } from '../../hooks/useDashboardData';
import { logger } from '../../utils/logger';
import TwoLineRow from '../patterns/TwoLineRow';
import { asLayout } from '../layout/resolveLayout';
import { installSettingsQuery, useLayout } from '../layout/useLayout';
import { useUserPreferences } from '../prefs/useUserPreferences';
import styles from './GeneralLayoutCard.module.css';

type Settings = Record<string, string | undefined>;
const USAGE_KEY = ['admin', 'layout-usage'];

export default function GeneralLayoutCard() {
  const { authStatus } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;
  return isAdmin ? <Cards /> : null;
}

function Cards() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings = {} } = useQuery(installSettingsQuery);
  const usage = useQuery({
    queryKey: USAGE_KEY,
    queryFn: async () =>
      (await apiService.get<{ data?: { windowDays: number; classic: number; workspace: number } }>('/api/admin/layout-usage')).data,
  });
  const { data: sources = [] } = useDashboardSources();
  const { prefs, isSuccess: prefsLoaded } = useUserPreferences();
  const { layout, setLayout } = useLayout();
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // Saved first, then cached: the layout gate reads this same settings entry,
  // so an optimistic `defaultLayout` would move the admin before the server answered.
  const save = async (key: string, value: string) => {
    setSaved((s) => ({ ...s, [key]: false }));
    try {
      // Changing the default never moves the admin making it: one without a
      // choice of their own first keeps the layout they are in (Ruling W).
      if (key === 'defaultLayout' && asLayout(prefs.layout) === null) await setLayout(layout);
      await apiService.post('/api/settings', { [key]: value });
    } catch (error) {
      logger.error(`Failed to save ${key}:`, error);
      showToast(t('common.save_failed'), 'error');
      return;
    }
    queryClient.setQueryData<Settings>(installSettingsQuery.queryKey, (prev) => ({ ...prev, [key]: value }));
    setSaved((s) => ({ ...s, [key]: true }));
    void queryClient.invalidateQueries({ queryKey: installSettingsQuery.queryKey });
    if (key === 'defaultLayout') void queryClient.invalidateQueries({ queryKey: USAGE_KEY });
  };

  const tick = (key: string) =>
    saved[key] && (
      <span className={styles.saved}>
        <UiIcon name="check" size={14} strokeWidth={3} />
        {t('workspace.saved')}
      </span>
    );

  const select = (key: string, label: string, value: string, options: Array<[string, string]>, disabled = false) => (
    <>
      {tick(key)}
      <select
        className={styles.select}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => void save(key, e.target.value)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
      <UiIcon name="chevronRight" size={18} />
    </>
  );

  // Today's choices for the default source (DefaultMeshtasticSourceSection).
  const sourceId = settings.defaultMeshtasticSourceId?.trim() ?? '';
  const tcp = sources.filter((s) => s.type === 'meshtastic_tcp');
  const sourceOptions: Array<[string, string]> = [
    ['', t('settings.default_source.automatic', 'Automatic (first started)')],
    ...tcp.map((s): [string, string] => [
      s.id,
      s.enabled ? s.name : t('settings.default_source.disabled_option', '{{name}} (disabled)', { name: s.name }),
    ]),
  ];
  if (sourceId && !tcp.some((s) => s.id === sourceId)) {
    sourceOptions.push([sourceId, t('settings.default_source.missing_option', 'Unknown source ({{id}})', { id: sourceId })]);
  }

  const offer = settings.offerWorkspaceBanner === 'true';
  const offerLabel = t('workspace.server.offer_banner');

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('workspace.server.general')}</h1>
        <p className={styles.scope}>{t('workspace.server.general_scope')}</p>
      </header>

      <h2 className={styles.groupTitle}>{t('workspace.you.layout')}</h2>
      <div className={styles.group}>
        <TwoLineRow
          data-testid="general-row"
          title={t('workspace.server.default_layout')}
          subtitle={t('workspace.server.default_layout_hint')}
          trailing={select(
            'defaultLayout',
            t('workspace.server.default_layout'),
            settings.defaultLayout === 'workspace' ? 'workspace' : 'classic',
            [
              ['classic', t('workspace.layout.classic')],
              ['workspace', t('workspace.layout.workspace')],
            ],
            // Until the admin's own choice is known, Ruling W cannot tell whether to keep it.
            !prefsLoaded,
          )}
        />
        <TwoLineRow
          data-testid="general-row"
          title={offerLabel}
          subtitle={t('workspace.server.offer_banner_hint')}
          trailing={
            <>
              {tick('offerWorkspaceBanner')}
              <input
                type="checkbox"
                role="switch"
                className={styles.switch}
                aria-label={offerLabel}
                checked={offer}
                onChange={(e) => void save('offerWorkspaceBanner', String(e.target.checked))}
              />
            </>
          }
        />
        <TwoLineRow
          data-testid="general-row"
          title={t('workspace.server.usage')}
          subtitle={usage.data && t('workspace.server.usage_hint', { days: usage.data.windowDays })}
          trailing={usage.data && t('workspace.server.usage_value', { classic: usage.data.classic, workspace: usage.data.workspace })}
        />
      </div>

      <h2 className={styles.groupTitle}>{t('workspace.server.sources')}</h2>
      <div className={styles.group}>
        <TwoLineRow
          data-testid="general-row"
          title={t('settings.default_source.title', 'Default Meshtastic source')}
          subtitle={t('settings.default_source.label', 'Source used when none is chosen')}
          trailing={select('defaultMeshtasticSourceId', t('settings.default_source.title', 'Default Meshtastic source'), sourceId, sourceOptions)}
        />
      </div>
    </div>
  );
}
