/**
 * Server › Security & privacy (boards 13-12 desktop, 13-28 phone). Admins see
 * every row. Anyone else with settings access sees the hosted documents, as
 * today: a settings writer edits them (`PUT/DELETE /api/privacy/admin/documents`,
 * settings:write); a settings reader views them (settings:read), with no
 * Upload, Publish or Unpublish. Every other key here is one the server keeps for admins
 * (GLOBAL_ONLY_SETTINGS_KEYS): today's page showed them to writers and dropped
 * their save. Server gates are unchanged.
 *
 * - Default Meshtastic source: set on Server › General (r4); a row links there.
 * - Remote Administration: today's admin command attempts (1–10), saved as you go.
 * - PKI direct message decryption (today's global switch, which forgets every
 *   stored key when turned off, as today, with no confirm) and the Reliable
 *   PKI default, saved as you go.
 * - Privacy: noindex, the three disclosure links (saved trimmed on blur; on
 *   phone each opens a field, s13n7), and today's hosted documents through
 *   PrivacyDocumentsSection's own hook (Rule X): Write / Edit in a sheet,
 *   Upload file, Publish, Unpublish (no confirm today) in the row's ⋯.
 *
 * Mesh impact: Reliable PKI "As needed" sends a node your node info first, at
 * most once an hour per node (today's per-node timer, stored in the database;
 * a save changes only the mode). Each extra admin command attempt is airtime,
 * as its help says. Nothing else here sends on the mesh.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { ACCEPTED_EXTENSIONS, usePrivacyDocuments } from '../../components/settings/usePrivacyDocuments';
import { useSettings } from '../../contexts/SettingsContext';
import { PRIVACY_DOCUMENT_SLUGS, PRIVACY_LINK_FALLBACK_LABEL, type PrivacyDocumentSlug } from '../../types/privacy';
import RowMenu from '../patterns/RowMenu';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import SettingGroup from '../settings/kit/SettingGroup';
import SettingRow from '../settings/kit/SettingRow';
import SettingText from '../settings/kit/SettingText';
import { useReadOnly } from '../settings/kit/useFieldRegistry';
import { AutoNumber, AutoSelect, AutoToggle, CommitOnBlur, SavedLine } from '../settings/categories/autosave';
import { Warn } from '../settings/categories/RowParts';
import { useAutosaveSetting } from '../settings/useAutosaveSetting';
import { useIsPhone } from '../shell/useIsPhone';
import ServerFrame from './ServerFrame';
import { useServerAccess } from './serverEntries';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import styles from './Server.module.css';

type ReliableMode = 'off' | 'asNeeded' | 'avoid';
const parseReliable = (v?: string): ReliableMode => (v === 'asNeeded' || v === 'avoid' ? v : 'off');

export default function SecurityPrivacyPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { isAdmin } = useServerAccess();
  return (
    <ServerFrame categoryId="security" title={t('workspace.server.nav.security')} scope={t('workspace.server.security_scope')} icon="security" gate="read">
      {isAdmin ? (
        <div className={prefs.columns} data-phone={isPhone || undefined}>
          <div className={prefs.column}>
            <SourcesGroup />
            <EncryptionGroup />
          </div>
          <div className={prefs.column}>
            <PrivacyGroup />
            <DocumentsGroup />
          </div>
        </div>
      ) : (
        <DocumentsGroup />
      )}
    </ServerFrame>
  );
}

function SourcesGroup() {
  const { t } = useTranslation();
  return (
    <SettingGroup title={t('workspace.server.sources_remote_admin')}>
      {/* r4: the default source is set on General; one place to save it. */}
      <Link to="/server/general" className={pages.linkRow}>
        <span className={pages.infoText}>
          <span className={pages.infoLabel}>{t('settings.default_source.title', 'Default Meshtastic source')}</span>
          <span className={pages.infoHelp}>
            {t('settings.default_source.label', 'Source used when none is chosen')} · {t('workspace.server.default_source_where')}
          </span>
        </span>
        <UiIcon name="chevronRight" size={18} />
      </Link>
      <h3 className={styles.subTitle}>{t('settings.remote_admin_section', 'Remote Administration')}</h3>
      <AutoNumber
        k="adminRetryAttempts"
        id="security.adminRetryAttempts"
        label={t('settings.admin_retry_attempts_label', 'Admin command attempts')}
        help={t('settings.admin_retry_attempts_description', 'How many times a remote admin command is attempted before giving up. Only a command that gets NO reply is retried — one the node explicitly refuses is never resent. Raise this for nodes on weak or lossy links. Each extra attempt is additional airtime, so the default of 1 sends exactly once. Range 1–10; default 1.')}
        min={1}
        max={10}
        parse={(raw) => {
          const n = parseInt(raw || '1', 10);
          return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 1;
        }}
      />
    </SettingGroup>
  );
}

function EncryptionGroup() {
  const { t } = useTranslation();
  const modeLabel = (m: ReliableMode) =>
    m === 'asNeeded' ? t('settings.reliable_pki.mode_as_needed', 'As needed') : m === 'avoid' ? t('settings.reliable_pki.mode_avoid', 'Avoid PKI') : t('settings.reliable_pki.mode_off', 'Off');
  return (
    <SettingGroup title={t('workspace.server.encryption')}>
      <AutoToggle
        k="pkiDmDecryptionGloballyEnabled"
        id="security.pkiDmDecryptionGloballyEnabled"
        label={t('settings.pki_dm.enable', 'Enable PKI direct message decryption')}
        help={t('settings.pki_dm.description', "Master switch for decrypting PKI-encrypted direct messages server-side so they appear in the unified Messages view. Off by default. When on, you can enable it per source under that source's Configuration tab (which stores that node's private key, encrypted). Turning this off forgets every stored key and stops all decryption. Requires SESSION_SECRET to be configured.")}
        parse={(raw) => raw === 'true'}
        serialize={(v) => (v ? 'true' : 'false')}
      />
      <AutoSelect
        segmented
        stacked
        k="reliablePkiMode"
        id="security.reliablePkiMode"
        label={t('settings.reliable_pki.global_label', 'Reliable PKI (default for every source)')}
        help={t('settings.reliable_pki.description')}
        parse={parseReliable}
        options={(['off', 'asNeeded', 'avoid'] as const).map((m) => ({ value: m, label: modeLabel(m) }))}
        render={(mode) => (
          <div className={pages.groupNote}>
            {mode === 'avoid' ? <Warn>{t('settings.reliable_pki.avoid_warning')}</Warn> : <SendsLine>{t('settings.reliable_pki.cost_warning')}</SendsLine>}
          </div>
        )}
      />
    </SettingGroup>
  );
}

function PrivacyGroup() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <SettingGroup title={t('settings.privacy', 'Privacy')}>
      <AutoToggle
        k="noIndexEnabled"
        id="security.noIndexEnabled"
        label={t('settings.no_index_enabled', 'Discourage search engine & LLM indexing')}
        help={t('settings.no_index_description', 'When enabled, MeshMonitor adds an "X-Robots-Tag: noindex, nofollow" header to every response and serves a disallow-all /robots.txt, asking search engines and LLM crawlers not to index this dashboard. Both are advisory — a crawler must choose to honor them. The robots.txt body is served in addition to the header because some reverse proxies (e.g. Cloudflare tunnels) strip custom headers at the edge.')}
        parse={(raw) => raw === '1' || raw === 'true'}
        serialize={(v) => (v ? '1' : '0')}
        onSaved={s.setNoIndexEnabled}
      />
      <h3 className={styles.subTitle}>{t('settings.privacy_disclosures', 'Disclosure links')}</h3>
      <p className={styles.cardPara}>
        {t('settings.privacy_disclosures_description', 'Shown in the sidebar footer, on the login page, and on public embed maps. Leave a field blank to render no link. Anything you host below overrides the matching URL here.')}
      </p>
      <UrlRow k="privacyPolicyUrl" label={t('settings.privacy_policy_url', 'Privacy policy URL')} placeholder="https://example.org/privacy" />
      <UrlRow k="termsOfServiceUrl" label={t('settings.terms_url', 'Terms of service URL')} placeholder="https://example.org/terms" />
      <UrlRow k="contactUrl" label={t('settings.contact_url', 'Contact URL')} placeholder="https://example.org/contact" />
      <p className={styles.cardPara}>{t('settings.privacy_url_help', 'Only http:// and https:// links are accepted — anything else is ignored rather than rendered.')}</p>
    </SettingGroup>
  );
}

/** A disclosure link, saved trimmed on blur or Enter. On phone the row shows its value and opens a field (s13n7). */
function UrlRow({ k, label, placeholder }: { k: string; label: string; placeholder: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const readOnly = useReadOnly();
  const [value, set, status] = useAutosaveSetting<string>(k, { commit: 'blur', parse: (raw) => raw ?? '', serialize: (v) => v.trim() });
  const [draft, setDraft] = useState<string | null>(null);
  const id = `security.${k}`;
  if (!isPhone) {
    return (
      <SettingRow id={id} label={label} stacked>
        <SavedLine status={status} />
        <CommitOnBlur status={status}>
          <SettingText value={value} onChange={set} placeholder={placeholder} />
        </CommitOnBlur>
      </SettingRow>
    );
  }
  return (
    <SettingRow id={id} label={label}>
      <SavedLine status={status} />
      <button type="button" className={pages.button} disabled={readOnly} onClick={() => setDraft(value)}>
        {value || t('workspace.server.url_hidden')}
        <UiIcon name="chevronRight" size={16} />
      </button>
      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={label} side="bottom">
        <div className={styles.sheetBody} data-phone="">
          <input type="url" inputMode="url" className={pages.keyInput} aria-label={label} placeholder={placeholder} value={draft ?? ''} onChange={(e) => setDraft(e.target.value)} />
          <div className={styles.sheetActions} data-phone="">
            <button
              type="button"
              className={`${pages.button} ${pages.primary}`}
              onClick={() => {
                set(draft ?? '');
                status.commit();
                setDraft(null);
              }}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Sheet>
    </SettingRow>
  );
}

function DocumentsGroup() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { canWrite } = useServerAccess();
  const docs = usePrivacyDocuments();
  const name = (slug: PrivacyDocumentSlug) => t(`privacy.link.${slug}`, PRIVACY_LINK_FALLBACK_LABEL[slug]);
  return (
    <SettingGroup title={t('settings.privacy_hosted_documents', 'Documents hosted here')}>
      <p className={styles.cardPara}>
        {t('settings.privacy_hosted_documents_description', 'Write or upload a document and MeshMonitor serves it at /privacy/<name>, so you do not need somewhere else to host it. Saved in the database, so it is included in system backups.')}
      </p>
      {docs.error && (
        <p className={styles.cardPara} role="alert">
          <span className={pages.error}>{docs.error}</span>
        </p>
      )}
      {!docs.loaded ? (
        <StateView kind="loading" />
      ) : (
        PRIVACY_DOCUMENT_SLUGS.map((slug) => {
          const hosted = docs.docs[slug];
          return (
            <div key={slug} className={styles.docRow} data-phone={isPhone || undefined}>
              <span className={styles.docText}>
                <span className={styles.docName}>
                  {name(slug)} <span className={pages.infoHelp}>/privacy/{slug}</span>
                </span>
                <span className={pages.infoHelp}>
                  {hosted ? t('privacy.docs.hosted_status', 'Hosted here — overrides the URL above.') : t('privacy.docs.not_hosted_status', 'Not hosted. The URL above is used, if set.')}
                  {hosted && ` · ${t('workspace.server.doc_updated', { date: new Date(hosted.updatedAt).toLocaleDateString() })}`}
                </span>
              </span>
              <span className={styles.badge} data-tone={hosted ? 'on' : undefined}>
                {hosted ? t('workspace.server.doc_published') : t('workspace.server.doc_not_hosted')}
              </span>
              <button
                type="button"
                className={pages.button}
                aria-label={hosted ? t('workspace.server.doc_edit', { name: name(slug) }) : t('workspace.server.doc_write', { name: name(slug) })}
                onClick={() => docs.setOpenSlug(slug)}
              >
                {hosted ? t('common.edit', 'Edit') : t('privacy.docs.write', 'Write')}
              </button>
              {canWrite && hosted && (
                <RowMenu
                  label={t('workspace.server.doc_actions', { name: name(slug) })}
                  items={[{ key: 'unpublish', label: t('privacy.docs.unpublish', 'Unpublish'), icon: 'delete', danger: true, disabled: docs.busySlug === slug, onSelect: () => void docs.handleDelete(slug) }]}
                />
              )}
            </div>
          );
        })
      )}
      {docs.openSlug && <DocumentSheet slug={docs.openSlug} title={name(docs.openSlug)} docs={docs} canEdit={canWrite} />}
    </SettingGroup>
  );
}

/** Today's editor (title, Markdown, Upload file, Publish) in a sheet. */
function DocumentSheet({ slug, title, docs, canEdit }: { slug: PrivacyDocumentSlug; title: string; docs: ReturnType<typeof usePrivacyDocuments>; canEdit: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const draft = docs.draftFor(slug);
  const busy = docs.busySlug === slug;
  const dirty = docs.drafts[slug] !== undefined;
  const [file, setFile] = useState<HTMLInputElement | null>(null);
  return (
    <Sheet
      open
      onClose={() => docs.setOpenSlug(null)}
      title={title}
      footer={
        canEdit && (
          <div className={styles.sheetActions} data-phone={isPhone || undefined}>
            <input
              ref={setFile}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void docs.handleFile(slug, f);
                e.target.value = '';
              }}
            />
            <button type="button" className={pages.button} disabled={busy} onClick={() => file?.click()}>
              <UiIcon name="upload" size={16} />
              {t('privacy.docs.upload', 'Upload file')}
            </button>
            <button type="button" className={`${pages.button} ${pages.primary}`} disabled={busy || !dirty} onClick={() => void docs.handleSave(slug)}>
              {busy ? t('common.saving', 'Saving...') : t('privacy.docs.publish', 'Publish')}
            </button>
          </div>
        )
      }
    >
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        {docs.error && <p className={pages.error} role="alert">{docs.error}</p>}
        <label className={styles.field}>
          <span className={pages.infoLabel}>{t('privacy.docs.title_label', 'Title')}</span>
          <input type="text" className={pages.keyInput} maxLength={255} disabled={!canEdit || busy} value={draft.title} onChange={(e) => docs.setDraft(slug, { title: e.target.value })} />
        </label>
        <label className={styles.field}>
          <span className={pages.infoLabel}>{t('privacy.docs.body_label', 'Document (Markdown)')}</span>
          <textarea
            className={styles.textarea}
            rows={14}
            disabled={!canEdit || busy}
            value={draft.content}
            placeholder={t('privacy.docs.body_placeholder', '# Privacy Policy\n\nWhat this instance collects, why, and who to contact.')}
            onChange={(e) => docs.setDraft(slug, { content: e.target.value })}
          />
        </label>
        <p className={pages.infoHelp}>
          {t('privacy.docs.markdown_help', 'Markdown only. HTML tags are not rendered — this is what keeps a hosted document from becoming a script on a page your anonymous visitors load.')}
        </p>
      </div>
    </Sheet>
  );
}
