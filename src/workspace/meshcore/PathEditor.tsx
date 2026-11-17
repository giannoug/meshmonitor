/**
 * The forwarding path editor (boards 8-05 inline, 8-20 "Edit path" sheet):
 * today's Define Path… dialog (MeshCoreContactDetailPanel) as hop chips. Hop
 * hash width 1/2/3 bytes (a change clears the hops, as today), repeaters by
 * name or a raw hex hash, move and remove, today's warning, then Save path:
 * one `PUT …/out-path` per press (today's `setContactOutPath`). It writes the
 * radio's contact record; nothing goes out on the mesh.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';
import { joinPathHops, parsePathHops, pathHashBytesOf, repeaterHopOptions, resolveHop, type PathHop } from '../../utils/meshcorePath';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './ContactPage.module.css';

export interface PathEditorProps {
  outPath: string | null | undefined;
  /** Every contact; the picker offers the repeaters and room servers. */
  contacts: MeshCoreContact[];
  /** Today's `setContactOutPath`; resolves false on failure. */
  onSave(outPath: string, hashBytes: 1 | 2 | 3): Promise<boolean>;
  /** Why it cannot be saved now (permission, link, receive-only), else undefined. */
  reason?: string;
  onSaved?(): void;
}

const WIDTHS = [1, 2, 3] as const;

export default function PathEditor({ outPath, contacts, onSave, reason, onSaved }: PathEditorProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [hops, setHops] = useState<PathHop[]>(() => parsePathHops(outPath));
  const [width, setWidth] = useState<1 | 2 | 3>(() => pathHashBytesOf(parsePathHops(outPath)));
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const options = useMemo(() => repeaterHopOptions(contacts, width), [contacts, width]);
  // Today's limits: 63 hops, and hops × width within the 64-byte path buffer.
  const maxHops = Math.min(63, Math.floor(64 / width));
  const off = saving || !!reason;
  const full = hops.length >= maxHops;

  const add = (hop: PathHop) => !full && setHops((prev) => [...prev, hop]);
  const addCustom = () => {
    const tok = custom.trim().toLowerCase();
    if (!new RegExp(`^[0-9a-f]{${width * 2}}$`).test(tok)) {
      setError(t('meshcore.contact_details.edit_path_invalid_byte', `Enter a ${width}-byte hex hash (${width * 2} hex chars).`));
      return;
    }
    setError(null);
    add(tok);
    setCustom('');
  };
  const move = (i: number, d: number) =>
    setHops((prev) => {
      const next = [...prev];
      if (i + d < 0 || i + d >= next.length) return prev;
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
  const changeWidth = (w: 1 | 2 | 3) => {
    if (w === width) return;
    setWidth(w);
    setHops([]);
    setCustom('');
    setError(null);
  };
  const save = async () => {
    if (off) return;
    if (hops.length > maxHops) {
      setError(t('meshcore.contact_details.edit_path_too_long', `Path too long: ${hops.length} hops (max ${maxHops}).`));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (await onSave(joinPathHops(hops), width)) onSaved?.();
      else setError(t('meshcore.contact_details.edit_path_save_failed', 'Save failed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.editor} data-phone={isPhone || undefined}>
      <ol className={styles.chips} aria-label={t('workspace.meshcore.path_hops')}>
        {hops.map((hop, i) => (
          <li key={`${hop}-${i}`} className={styles.chipItem}>
            {i > 0 && <UiIcon name="forward" size={16} className={styles.arrow} />}
            <span className={styles.chip}>
              <code className={styles.hash}>{hop}</code>
              <span>{resolveHop(hop, options).label}</span>
              <button type="button" className={styles.chipButton} disabled={off || i === 0} onClick={() => move(i, -1)}
                aria-label={t('meshcore.contact_details.edit_path_move_up', 'Move hop up')}>
                <UiIcon name="back" size={14} />
              </button>
              <button type="button" className={styles.chipButton} disabled={off || i === hops.length - 1} onClick={() => move(i, 1)}
                aria-label={t('meshcore.contact_details.edit_path_move_down', 'Move hop down')}>
                <UiIcon name="forward" size={14} />
              </button>
              <button type="button" className={styles.chipButton} disabled={off} onClick={() => setHops((prev) => prev.filter((_, j) => j !== i))}
                aria-label={t('meshcore.contact_details.edit_path_remove_hop', 'Remove hop')}>
                <UiIcon name="close" size={14} />
              </button>
            </span>
          </li>
        ))}
        {hops.length === 0 && <li className={styles.muted}>{t('workspace.meshcore.path_direct_hint')}</li>}
      </ol>
      <div className={styles.row}>
        <select
          className={styles.input}
          aria-label={t('workspace.meshcore.add_hop')}
          disabled={off || full}
          value=""
          onChange={(e) => e.target.value && add(e.target.value)}
        >
          <option value="">{options.length ? t('workspace.meshcore.add_hop') : t('meshcore.contact_details.edit_path_no_repeaters', 'No known repeaters')}</option>
          {options.map((o) => (
            <option key={o.publicKey} value={o.hopByte}>{o.hopByte} {o.name}</option>
          ))}
        </select>
        <input
          className={styles.input}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          disabled={off || full}
          aria-label={t('workspace.meshcore.add_hash')}
          placeholder={'a3'.repeat(width)}
        />
        <button type="button" className={styles.button} onClick={addCustom} disabled={off || full || !custom.trim()}>
          {t('workspace.meshcore.add')}
        </button>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>{t('workspace.meshcore.hop_hash')}</span>
        <span className={styles.segments} role="group" aria-label={t('workspace.meshcore.hop_hash')}>
          {WIDTHS.map((w) => (
            <button key={w} type="button" className={styles.segment} aria-pressed={w === width} disabled={off} onClick={() => changeWidth(w)}>
              {t('workspace.meshcore.hop_width', { n: w })}
            </button>
          ))}
        </span>
        <span className={styles.spacer} />
        <button type="button" className={styles.button} onClick={() => void save()} disabled={off}>
          {saving ? t('common.saving') : t('workspace.meshcore.save_path')}
        </button>
      </div>
      <p className={styles.muted}>
        {t('workspace.meshcore.path_warning')}
      </p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {reason ? <p className={styles.reason}>{reason}</p> : <SendsLine>{t('workspace.meshcore.sends_set_path')}</SendsLine>}
    </div>
  );
}
