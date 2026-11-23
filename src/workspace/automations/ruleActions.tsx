/**
 * A rule's row and header actions, shared by the rules list (14-01, 14-09) and
 * a rule's page (m2, n2): the enable switch, Export (today's JSON to the
 * clipboard), Duplicate (a name asked for in a sheet, in place of today's
 * `prompt`) and Delete (a plain ConfirmSheet with today's words, in place of
 * today's `confirm`; Ruling D9d). Each sends today's request once per press.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import apiService from '../../services/api';
import { useToast } from '../../components/ToastContainer';
import type { Automation } from '../../components/automations/automationsPageLogic';
import ConfirmSheet from '../patterns/ConfirmSheet';
import Sheet from '../patterns/Sheet';
import { ruleUrl, rulesQuery } from './engineRules';
import { readGraph, ruleSends } from './rules';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function useRuleActions({ afterDelete }: { afterDelete?: string } = {}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [dup, setDup] = useState<{ rule: Automation; name: string } | null>(null);
  const [del, setDel] = useState<Automation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = () => queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey });

  /** Today's enable / disable request, one in flight; the switch waits for the re-read. */
  const toggle = async (r: Automation) => {
    if (busy) return;
    setBusy(r.id);
    try {
      await apiService.post(`/api/automations/${encodeURIComponent(r.id)}/${r.enabled ? 'disable' : 'enable'}`);
    } catch (e) {
      showToast(errorText(e, t('workspace.rules.save_failed')), 'error');
    }
    await reload();
    setBusy(null);
  };

  const exportRule = async (r: Automation) => {
    try {
      const data = await apiService.get(`/api/automations/${encodeURIComponent(r.id)}/export`);
      await navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
      showToast(t('workspace.rules.exported'), 'success');
    } catch (e) {
      showToast(errorText(e, t('workspace.rules.export_failed')), 'error');
    }
  };

  const duplicate = async () => {
    if (!dup || busy) return;
    const name = dup.name.trim();
    // Today: an empty name does nothing.
    if (!name) return;
    setBusy(dup.rule.id);
    setError(null);
    try {
      const created = await apiService.post<Automation>(`/api/automations/${encodeURIComponent(dup.rule.id)}/duplicate`, { name });
      await reload();
      setDup(null);
      // Today opens the disabled copy so it is reviewed before it is turned on.
      void navigate(ruleUrl(created.id));
    } catch (e) {
      setError(errorText(e, t('workspace.rules.duplicate_failed')));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!del) return;
    setBusy(del.id);
    try {
      await apiService.delete(`/api/automations/${encodeURIComponent(del.id)}`);
      await reload();
      queryClient.removeQueries({ queryKey: ['workspace', 'automations', 'runs', del.id] });
      setDel(null);
      if (afterDelete) void navigate(afterDelete);
    } finally {
      setBusy(null);
    }
  };

  const sheets: ReactNode = (
    <>
      <Sheet
        open={!!dup}
        onClose={() => { setDup(null); setError(null); }}
        title={t('workspace.rules.duplicate_title', { name: dup?.rule.name ?? '' })}
        footer={
          <div className={own.sheetButtons}>
            <button type="button" className={styles.button} onClick={() => { setDup(null); setError(null); }}>{t('common.cancel')}</button>
            <button type="submit" form="rule-duplicate" className={`${styles.button} ${styles.primary}`} disabled={!!busy || !dup?.name.trim()} aria-busy={!!busy || undefined}>
              {t('workspace.rules.duplicate')}
            </button>
          </div>
        }
      >
        <form id="rule-duplicate" className={own.form} onSubmit={(e) => { e.preventDefault(); void duplicate(); }}>
          <label className={styles.field}>
            <span>{t('workspace.rules.duplicate_name')}</span>
            <input className={styles.input} value={dup?.name ?? ''} onChange={(e) => setDup((d) => (d ? { ...d, name: e.target.value } : d))} />
          </label>
          <p className={styles.muted}>{t('workspace.rules.duplicate_note')}</p>
          {error && <p className={own.error} role="alert">{error}</p>}
        </form>
      </Sheet>
      <ConfirmSheet
        open={!!del}
        danger
        title={t('workspace.rules.delete_title', { name: del?.name ?? '' })}
        body={<p className={own.confirmLead}>{t('workspace.rules.delete_removes')}</p>}
        consequences={del ? [
          t('workspace.rules.delete_rule', { name: del.name }),
          t('workspace.rules.delete_runs'),
          t('workspace.rules.delete_stops', { sends: ruleSends(readGraph(del.config), t) }),
          t('workspace.rules.delete_instead'),
        ] : []}
        confirmLabel={t('common.delete')}
        busy={!!busy}
        onConfirm={remove}
        onCancel={() => setDel(null)}
      />
    </>
  );

  return {
    busy,
    toggle: (r: Automation) => void toggle(r),
    exportRule: (r: Automation) => void exportRule(r),
    askDuplicate: (r: Automation) => setDup({ rule: r, name: `${r.name} (copy)` }),
    askDelete: (r: Automation) => setDel(r),
    sheets,
  };
}

