/**
 * Overview › Automations › Templates (Task 8.4; 14-03, 14-11): today's
 * template gallery (TemplateGallery's registry) and a template's wizard,
 * docked beside the gallery on desktop and a page of its own on the phone.
 * The wizard asks today's Name (and Description for a single-rule template)
 * and the template's parameters (today's field renderer), shows that every
 * install starts disabled and what the rules would send once on, and installs
 * exactly as today (`prepareTemplateInstall`, one POST /api/automations/import
 * per rule, in order). The results list each rule with Open (s14n4).
 * Installing needs automations:write (s14n7).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon, UI_ICON_DEFINITIONS, type UiIconName } from '../../components/icons';
import { FieldInput } from '../../components/automations/AutomationBuilder';
import { fieldVisible } from '../../components/automations/catalog';
import { TEMPLATES } from '../../components/automations/templates';
import {
  installTemplateAutomations, isMultiTemplate, prepareTemplateInstall, seedFromBuild, type InstallOutcome,
} from '../../components/automations/templates/install';
import type { AutomationTemplate } from '../../components/automations/templates/types';
import SendsLine from '../patterns/SendsLine';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import { ENGINE, ENGINE_TEMPLATES, ruleUrl, rulesQuery } from './engineRules';
import { ruleSends } from './rules';
import { useBuilderData } from './useBuilderData';
import styles from '../meshcore/McTools.module.css';
import own from './Rules.module.css';

const iconOf = (name: string): UiIconName => (name in UI_ICON_DEFINITIONS ? name : 'bot') as UiIconName;

export default function TemplateWizard({ templateId }: { templateId: string | null }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const template = TEMPLATES.find((x) => x.id === templateId) ?? null;

  if (isPhone && template) return <Wizard key={template.id} template={template} />;

  const gallery = (
    <section className={styles.section} aria-label={t('workspace.rules.tpl.gallery', { count: TEMPLATES.length })}>
      <h2 className={styles.sectionTitle}>{t('workspace.rules.tpl.gallery', { count: TEMPLATES.length })}</h2>
      <div className={own.templateGrid}>
        {TEMPLATES.map((x) => (
          <article key={x.id} className={`${styles.card} ${own.templateCard}`} data-selected={x.id === templateId || undefined}>
            <h3 className={own.templateName}><span className={own.templateIcon}><UiIcon name={iconOf(x.icon)} size={20} /></span>{x.name}</h3>
            <p className={own.templateText}>{x.description}</p>
            <p className={own.tags}>{x.tags.map((tag) => <span key={tag} className={own.chip}>{tag}</span>)}</p>
            <Link className={`${styles.button} ${x.id === templateId ? '' : styles.primary}`} to={`${ENGINE_TEMPLATES}/${x.id}`}>{t('workspace.rules.tpl.use')}</Link>
          </article>
        ))}
      </div>
      {!isPhone && (
        <p className={styles.note}>
          <UiIcon name="info" size={16} />
          <span>{t('workspace.rules.tpl.note')}</span>
        </p>
      )}
    </section>
  );

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {!isPhone && <Link className={own.crumb} to={ENGINE}><UiIcon name="back" size={14} /> {t('workspace.meshcore.auto.title')}</Link>}
      <ToolHead title={t('workspace.meshcore.auto.templates')} subtitle={t('workspace.rules.tpl.subtitle')} back={{ label: t('workspace.meshcore.auto.title'), to: ENGINE }} />
      {template ? (
        <div className={own.withPanel}>
          {gallery}
          <Wizard key={template.id} template={template} />
        </div>
      ) : gallery}
    </div>
  );
}

function Wizard({ template }: { template: AutomationTemplate }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('automations', 'write');
  const data = useBuilderData(true);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [name, setName] = useState(() => seedFromBuild(template)?.name ?? template.name);
  const [description, setDescription] = useState(() => seedFromBuild(template)?.description ?? template.description);
  const [advanced, setAdvanced] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [installing, setInstalling] = useState(false);
  const [outcomes, setOutcomes] = useState<InstallOutcome[] | null>(null);
  const multi = isMultiTemplate(template);
  if (!hasPermission('automations', 'read')) return <StateView kind="noPermission" />;
  const close = () => navigate(ENGINE_TEMPLATES);

  // What the current answers would install (no request), for the note and the Sends line.
  const preview = prepareTemplateInstall(template, values, name, description);
  const list = 'list' in preview ? preview.list : [];

  const install = async () => {
    if (installing) return;
    setErrors([]);
    setOutcomes(null);
    const prepared = prepareTemplateInstall(template, values, name, description);
    if ('errors' in prepared) {
      setErrors(prepared.errors);
      return;
    }
    setInstalling(true);
    const results = await installTemplateAutomations(prepared.list);
    setInstalling(false);
    setOutcomes(results);
    await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey });
  };

  const field = (p: AutomationTemplate['params'][number]) => (
    <div key={p.name} className={own.fields}>
      <FieldInput
        field={p}
        value={values[p.name]}
        variables={[]}
        sources={data.sources}
        channels={data.channels}
        scripts={[]}
        regions={[]}
        nodes={data.nodes}
        triggerType="trigger.message"
        onChange={(v) => setValues((prev) => ({ ...prev, [p.name]: v }))}
      />
    </div>
  );
  const visible = template.params.filter((p) => fieldVisible(p, values));
  const body = (
    <>
      <p className={own.crumbs}>
        <span>{t('workspace.rules.tpl.step_template')}</span><UiIcon name="chevronRight" size={12} />
        <strong>{t('workspace.rules.tpl.step_parameters')}</strong><UiIcon name="chevronRight" size={12} />
        <span>{t('workspace.rules.tpl.step_install')}</span>
      </p>
      <p className={own.templateText}>{template.description}</p>
      <div className={own.fields}>
        <label className={styles.field}>
          <span>{t('workspace.rules.var.name')}</span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {!multi && (
          <label className={styles.field}>
            <span>{t('workspace.rules.description')}</span>
            <textarea className={own.textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        )}
      </div>
      <h3 className={styles.sectionTitle}>{t('workspace.rules.tpl.parameters')}</h3>
      <div className={own.paramGrid}>{visible.filter((p) => !p.advanced).map(field)}</div>
      {visible.some((p) => p.advanced) && (
        <>
          <button type="button" className={own.disclosure} aria-expanded={advanced} onClick={() => setAdvanced((x) => !x)}>
            <UiIcon name={advanced ? 'chevronDown' : 'chevronRight'} size={14} />
            {t('workspace.rules.tpl.advanced')}
          </button>
          {advanced && <div className={own.paramGrid}>{visible.filter((p) => p.advanced).map(field)}</div>}
        </>
      )}
      <p className={styles.banner} role="note">
        <UiIcon name="info" size={16} />
        <span>{list.length ? t('workspace.rules.tpl.installs_disabled', { count: list.length, names: list.map((a) => a.name).join(', ') }) : t('workspace.rules.tpl.installs_disabled_none')}</span>
      </p>
      {list.length > 0 && <SendsLine>{t('workspace.rules.tpl.when_on', { sends: list.map((a) => ruleSends(a.config, t)).join(' · ') })}</SendsLine>}
      {errors.length > 0 && <ul className={own.error} role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {outcomes && (
        <ul className={own.outcomes} aria-label={t('workspace.rules.tpl.results')}>
          {outcomes.map((o) => (
            <li key={o.name} data-ok={o.status === 'success' || undefined}>
              {o.status === 'success' ? (
                <>
                  <span>{t('workspace.rules.tpl.installed', { name: o.name })}</span>
                  <Link className={styles.link} to={ruleUrl(o.row.id)}>{t('workspace.rules.tpl.open')}</Link>
                </>
              ) : (
                <span>{t('workspace.rules.tpl.failed', { name: o.name, error: o.error })}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
  const buttons = (
    <div className={own.sheetButtons}>
      <button type="button" className={styles.button} onClick={close}><UiIcon name="back" size={14} />{t('workspace.rules.tpl.back')}</button>
      {!isPhone && <button type="button" className={styles.button} onClick={close}>{t('common.cancel')}</button>}
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canWrite || installing} aria-busy={installing || undefined} onClick={() => void install()}>
        <UiIcon name="download" size={16} />
        {installing ? t('workspace.rules.tpl.installing') : t('workspace.rules.tpl.install')}
      </button>
    </div>
  );
  const title = <><span className={own.templateIcon}><UiIcon name={iconOf(template.icon)} size={20} /></span>{template.name}</>;

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <ToolHead title="" back={{ label: t('workspace.meshcore.auto.templates'), to: ENGINE_TEMPLATES }} phoneActions={null} />
        <h1 className={own.templateTitle}>{title}</h1>
        {body}
        <div className={own.phoneDock}>{buttons}</div>
      </div>
    );
  }
  return (
    <aside className={`${styles.panel} ${own.wizard}`} aria-label={template.name}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <button type="button" className={styles.iconButton} aria-label={t('common.close')} onClick={close}><UiIcon name="close" size={16} /></button>
      </div>
      <div className={own.panelBody}>{body}</div>
      <div className={own.panelFoot}>{buttons}</div>
    </aside>
  );
}
