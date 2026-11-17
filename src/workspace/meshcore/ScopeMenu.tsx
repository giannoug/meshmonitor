/**
 * The send scope of the next message on a MeshCore channel (board 8-01's
 * menu, 8-19's chip; today's one-off scope override, #3701): the default
 * (the channel's scope, else the device's), saved regions, regions found
 * nearby, Unscoped flood, any other region typed in, and Reset to default.
 * The choice applies to sends from this screen and resets per channel.
 *
 * Opening it the first time asks nearby repeaters for their regions, as
 * opening today's override does (once per screen, never in receive-only;
 * #3704): its Sends line says so.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import SendsLine from '../patterns/SendsLine';
import styles from './ScopeMenu.module.css';

export interface ChannelScope {
  /** The channel's scope, else the device default; '' when neither. */
  base: string;
  /** null: the default; '' unscoped; else a region. */
  override: string | null;
  send: string;
  saved: string[];
  discovered: string[];
  setOverride(scope: string | null): void;
  onMenuOpen(): void;
}

export default function ScopeMenu({ channelName, scope, receiveOnly, phone }: { channelName: string; scope: ChannelScope; receiveOnly: boolean; phone: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const wrap = useRef<HTMLSpanElement>(null);
  const unscoped = t('meshcore.scope.unscoped', 'unscoped');
  const label = t('workspace.meshcore.scope_menu', { channel: channelName });

  useEffect(() => {
    if (!open) return;
    scope.onMenuOpen();
    wrap.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // Opening is the trigger; scope's callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 runs once per open
  }, [open]);

  const choose = (value: string | null) => {
    scope.setOverride(value);
    setOpen(false);
  };
  const regions = [...scope.saved.map((r) => ({ r, hint: t('workspace.meshcore.scope_saved') })),
    ...scope.discovered.filter((r) => !scope.saved.includes(r)).map((r) => ({ r, hint: t('workspace.meshcore.scope_suggested') }))]
    .filter(({ r }) => r && r !== scope.base);
  const option = (key: string, value: string | null, title: string, hint: string) => (
    <button
      key={key}
      type="button"
      role="menuitemradio"
      aria-checked={scope.override === value}
      className={styles.option}
      data-phone={phone || undefined}
      onClick={() => choose(value)}
    >
      <span className={styles.radio} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
    </button>
  );

  return (
    <span
      className={styles.wrap}
      ref={wrap}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={styles.trigger}
        data-phone={phone || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('meshcore.scope.override_toggle_title', 'Send this message under a one-off region/scope override')}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon name="globe" size={16} />
        {t('meshcore.scope.override_toggle', 'Scope: {{scope}}', { scope: scope.send || unscoped })}
        <UiIcon name="chevronDown" size={14} />
      </button>
      {open && (
        <span className={styles.menu} role="menu" aria-label={label} data-phone={phone || undefined}>
          <span className={styles.heading}>{label}</span>
          {option('default', null, t('workspace.meshcore.scope_default', { scope: scope.base || unscoped }), t('workspace.meshcore.scope_default_hint'))}
          {regions.map(({ r, hint }) => option(`r-${r}`, r, r, hint))}
          {option('unscoped', '', t('workspace.meshcore.scope_unscoped'), t('workspace.meshcore.scope_unscoped_hint'))}
          <form
            className={styles.other}
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) choose(typed.trim());
            }}
          >
            <label className={styles.otherLabel}>
              {t('meshcore.scope.override_label', 'Send scope')}
              <input
                className={styles.input}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={scope.base ? t('meshcore.scope.override_placeholder', 'e.g. {{scope}}', { scope: scope.base }) : unscoped}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <button type="submit" className={styles.use} disabled={!typed.trim()}>
              {t('workspace.meshcore.scope_use')}
            </button>
          </form>
          {scope.override !== null && (
            <button type="button" role="menuitem" className={styles.reset} onClick={() => choose(null)}>
              {t('workspace.meshcore.scope_reset')}
            </button>
          )}
          {!receiveOnly && <span className={styles.sends}><SendsLine>{t('workspace.meshcore.sends_discover_regions')}</SendsLine></span>}
        </span>
      )}
    </span>
  );
}
