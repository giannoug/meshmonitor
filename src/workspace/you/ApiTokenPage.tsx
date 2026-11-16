/**
 * You › API Token (boards 11-05, 11-13; s11n1, s11n3) over Classic's
 * `useApiToken` (Rule X): today's GET /api/token, POST /api/token/generate and
 * DELETE /api/token.
 *
 * - A new token shows once in a OneTimeReveal with Copy (today's copy and
 *   toast) and Dismiss. Dismiss, Revoke or leaving the page drops it.
 * - One token per user, as today: Revoke (a ConfirmSheet with today's words),
 *   then Generate. There is no Regenerate.
 * - Using it: today's Authorization header line and the API docs link.
 *
 * `ApiTokenSection` is the reveal and the token card; Sign-in & security
 * draws it `compact` (no detail rows).
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useApiToken } from '../../components/account/useApiToken';
import ConfirmSheet from '../patterns/ConfirmSheet';
import OneTimeReveal from '../patterns/OneTimeReveal';
import YouPageFrame, { Section } from './YouPageFrame';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './YouAccount.module.css';

const DOCS = '/api/v1/docs';

export default function ApiTokenPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const docs = (
    <a className={styles.btn} href={DOCS} target="_blank" rel="noopener noreferrer">
      <UiIcon name="code" size={16} />
      {t('api_token.view_api_docs')}
    </a>
  );
  return (
    <YouPageFrame
      title={t('api_token.title')}
      scope={t('workspace.you.token.scope')}
      crumb={t('workspace.you.account')}
      back={{ label: t('workspace.tabs.you'), to: '/you' }}
      actions={!isPhone && docs}
    >
      <ApiTokenSection>
        <Section title={t('api_token.usage_title')}>
          <div className={styles.card} data-pad="">
            <p className={styles.sheetText}>{t('api_token.usage_instruction')}</p>
            <pre className={styles.code}><code>Authorization: Bearer YOUR_TOKEN_HERE</code></pre>
            <p className={styles.sheetText}>{t('api_token.description')}</p>
            {isPhone && docs}
          </div>
        </Section>
      </ApiTokenSection>
    </YouPageFrame>
  );
}

export function ApiTokenSection({ compact = false, children }: { compact?: boolean; children?: ReactNode }) {
  const { t } = useTranslation();
  const { tokenState, generatedToken, loading, isGenerating, isRevoking, generate, revoke, copy, dismiss } = useApiToken();
  const [confirm, setConfirm] = useState(false);
  const token = tokenState.hasToken ? tokenState.token : null;
  const formatDate = (ms: number) => new Date(ms).toLocaleString();

  return (
    <>
      {generatedToken && (
        <div className={styles.card} data-pad="" data-tone="reveal">
          <OneTimeReveal
            title={t('api_token.token_generated')}
            intro={t('api_token.save_warning')}
            label={t('api_token.title')}
            secrets={[generatedToken]}
            onCopy={copy}
            copyLabel={t('common.copy')}
            onDone={dismiss}
            doneLabel={t('common.dismiss')}
          />
        </div>
      )}
      {children}
      {compact ? null : <h2 className={styles.sectionTitle}>{t('workspace.you.token.your_token')}</h2>}
      <div className={styles.card}>
        {loading ? (
          <p className={styles.row}>{t('api_token.loading')}</p>
        ) : token ? (
          <>
            {compact ? (
              <div className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{t('workspace.you.token.summary')}</span>
                </span>
                <code className={styles.prefix}>{token.prefix}...</code>
                <span className={styles.actions}>
                  <button type="button" className={styles.btn} data-variant="danger" onClick={() => setConfirm(true)} disabled={isRevoking}>
                    {t('api_token.revoke')}
                  </button>
                </span>
              </div>
            ) : (
              <>
                <Detail label={t('api_token.prefix')} value={<code>{token.prefix}...</code>} />
                <Detail label={t('api_token.created')} value={formatDate(token.createdAt)} />
                <Detail label={t('api_token.last_used')} value={token.lastUsedAt ? formatDate(token.lastUsedAt) : t('time.never')} />
                <Detail label={t('api_token.status')} value={<span className={styles.badge}>{t('api_token.status_active')}</span>} />
                <div className={styles.row}>
                  <span className={styles.rowText}>
                    <span className={styles.rowSub}>{t('workspace.you.token.replace')}</span>
                  </span>
                  <span className={styles.actions}>
                    <button type="button" className={styles.btn} data-variant="danger" onClick={() => setConfirm(true)} disabled={isRevoking}>
                      {t('api_token.revoke')}
                    </button>
                  </span>
                </div>
              </>
            )}
          </>
        ) : (
          <div className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{t('api_token.no_token')}</span>
            </span>
            <span className={styles.actions}>
              <button type="button" className={styles.btn} data-variant="primary" onClick={() => void generate()} disabled={isGenerating}>
                <UiIcon name="plus" size={16} />
                {isGenerating ? t('api_token.generating') : t('api_token.generate')}
              </button>
            </span>
          </div>
        )}
      </div>

      <ConfirmSheet
        open={confirm}
        title={t('api_token.revoke')}
        body={t('api_token.revoke_confirm')}
        confirmLabel={isRevoking ? t('api_token.revoking') : t('api_token.yes_revoke')}
        danger
        busy={isRevoking}
        submitOnEnter={false}
        onConfirm={async () => {
          if (await revoke()) setConfirm(false);
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowText}>
        <span className={styles.rowSub}>{label}</span>
      </span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}
