/**
 * A remote repeater setting's value on the row kit (board 8-07): the value
 * (with its unit) and a chevron; pressing it opens a sheet titled with the
 * row, holding today's field (NumberInput with its range, today's Off box and
 * out-of-range note, or the name field with today's byte rule). The value
 * goes to the target's draft as it is typed; Done closes the sheet. Nothing is
 * sent until Send to node.
 */
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { NumberInput } from '../../../components/common/NumberInput';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import type { DraftKey } from '../../../components/MeshCore/hooks/useRepeaterSettingsDraft';
import {
  effectiveRepeaterMax,
  getRepeaterSettingDef,
  repeaterValuesEqual,
  validateRepeaterValue,
} from '../../../utils/meshcoreRepeaterSettings';
import Sheet from '../../patterns/Sheet';
import { useReadOnly, useSettingRow } from '../../settings/kit/useFieldRegistry';
import { useIsPhone } from '../../shell/useIsPhone';
import { formatSetting, type MeshCoreTarget } from './remoteTarget';
import styles from './McRemote.module.css';

export default function SettingValue({ target, k, step = 1 }: { target: MeshCoreTarget; k: DraftKey; step?: number }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const row = useSettingRow();
  const id = useId();
  const [open, setOpen] = useState(false);
  const { draft: d } = target;
  const current = d.baseline[k];
  // The draft follows a new read one render later (today's effect); show the read value meanwhile.
  const value = d.draft[k] ?? current;
  const off = useReadOnly() || d.locked || current === undefined;
  const def = getRepeaterSettingDef(k);
  const changed = value !== undefined && current !== undefined && !repeaterValuesEqual(k, value, current);

  let field;
  if (k === 'name') {
    field = (
      <>
        <input
          id={id}
          type="text"
          className={styles.input}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => d.setField('name', e.target.value)}
        />
        <p className={d.nameCheck?.ok === false ? styles.error : styles.note}>
          {d.nameCheck?.ok === false ? t('meshcore.repeater.remote_name_invalid') : t('meshcore.repeater.remote_name_hint')}
        </p>
      </>
    );
  } else if (def) {
    const max = effectiveRepeaterMax(def, d.gates);
    const isOff = def.offAllowed === true && value === 0;
    // Today's form keeps a stored value outside MeshMonitor's range valid until it is changed.
    const legacy = typeof current === 'number' && !validateRepeaterValue(k, current, d.gates).ok ? current : null;
    field = (
      <>
        <span className={styles.field}>
          <NumberInputScope scope={target.numbers}>
            <NumberInput
              id={id}
              className={styles.input}
              min={def.min}
              max={max}
              step={step}
              integer={Number.isInteger(step)}
              alsoValid={[...(legacy !== null ? [legacy] : []), ...(def.offAllowed ? [0] : [])]}
              value={isOff ? 0 : typeof value === 'number' ? value : null}
              onChange={(n) => d.setField(k, n)}
              disabled={isOff}
            />
          </NumberInputScope>
          {def.unit && <span className={styles.label}>{def.unit}</span>}
          {def.offAllowed && (
            <label className={styles.check}>
              <input type="checkbox" checked={isOff} onChange={(e) => d.setField(k, e.target.checked ? 0 : (legacy ?? def.min ?? 0))} />
              {t('meshcore.repeater.off', 'Off')}
            </label>
          )}
        </span>
        <p className={styles.note}>
          {t('meshcore.repeater.range', { range: `${def.min}–${max}${def.unit ? ` ${def.unit}` : ''}` })}
          {def.offAllowed ? ` ${t('meshcore.repeater.or_off', 'or Off.')}` : ''}
        </p>
        {legacy !== null && (
          <p className={styles.note}>{t('meshcore.repeater.out_of_range', { value: legacy, unit: def.unit ?? '' })}</p>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={styles.value}
        id={row?.inputId}
        aria-describedby={row?.helpId}
        aria-haspopup="dialog"
        data-changed={changed || undefined}
        disabled={off}
        onClick={() => setOpen(true)}
      >
        <span>{formatSetting(t, k, value)}</span>
        <UiIcon name="chevronRight" size={18} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={row?.label ?? ''} side={isPhone ? 'bottom' : 'auto'}>
        <div className={styles.sheet} data-phone={isPhone || undefined}>
          <label htmlFor={id} className={styles.label}>{row?.label}</label>
          {field}
          <button type="button" className={styles.primary} onClick={() => setOpen(false)}>
            {t('common.done', 'Done')}
          </button>
        </div>
      </Sheet>
    </>
  );
}
