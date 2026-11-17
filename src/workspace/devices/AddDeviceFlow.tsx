/**
 * Add device (ds5; h1–h3 desktop, i1–i3 phone, 18-09/18-10 Reticulum): type,
 * connection, then name and connect. Admins only, as today's Add Source.
 *
 * - Save is today's add (`useSourceForm.submit`): one POST, which starts the
 *   device's manager as today. It then shows what the device's status says:
 *   connected (Add another, Open), or why not (Edit connection, Try again,
 *   Save anyway). The device is saved either way.
 * - Try again is today's Connect, once per press: POST `/connect`, then
 *   today's re-poll of the status (every 1.5 s, at most 20 s, until
 *   connected), stopped when the flow closes. Nothing retries on its own.
 * - Edit connection goes back to step 2; saving again is a PUT.
 * - `editId` opens the same flow on a saved device at step 2 (Server ›
 *   Devices › Edit); its type stays, as today.
 *
 * Desktop draws a centred dialog; phone a full-screen page with its own bar.
 * Esc closes it (one layer, CR) unless a save is running.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useIsPhone } from '../shell/useIsPhone';
import ConnectionStep from './ConnectionStep';
import { ConnectResult, NameFields } from './ConnectStep';
import { autoConnectOf, useConnectResult } from './connectResult';
import TypeStep from './TypeStep';
import { connectSourceAndWait, useSourceForm, type SourceForm } from './useSourceForm';
import styles from './Devices.module.css';

type Step = 1 | 2 | 3;

export interface AddDeviceFlowProps {
  sources: DashboardSource[];
  /** Edit this saved device instead of adding one. */
  editId?: string | null;
  onClose(): void;
}

export default function AddDeviceFlow(props: AddDeviceFlowProps) {
  return createPortal(<Flow {...props} />, document.body);
}

function Flow({ sources, editId, onClose }: AddDeviceFlowProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useSourceForm(sources);
  const [step, setStep] = useState<Step>(editId ? 2 : 1);
  const [saved, setSaved] = useState<DashboardSource | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retry = useRef<AbortController | null>(null);

  useEffect(() => {
    if (editId) form.startEdit(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 fill the form once, when the flow opens
  }, [editId]);
  // Closing stops a Try again's re-poll.
  useEffect(() => () => retry.current?.abort(), []);

  const close = () => {
    if (!form.formSaving) onClose();
  };
  const { contentRef, onKeyDown } = useDialogA11y(close);

  const next = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    const error = form.validate({ connectionOnly: true });
    setStepError(error);
    if (!error) setStep(3);
  };
  const back = () => {
    setStepError(null);
    if (saved) {
      setSaved(null);
      setStep(2);
    } else if (step > (editId ? 2 : 1)) {
      setStep((s) => (s - 1) as Step);
    }
  };
  const save = async () => {
    const result = await form.submit();
    if (result) setSaved(result);
  };
  const tryAgain = async () => {
    if (!saved || retrying) return;
    retry.current?.abort();
    const ctl = new AbortController();
    retry.current = ctl;
    setRetrying(true);
    try {
      await connectSourceAndWait(queryClient, saved.id, ctl.signal);
    } finally {
      if (!ctl.signal.aborted) setRetrying(false);
    }
  };
  const addAnother = () => {
    form.startAdd();
    setSaved(null);
    setStepError(null);
    setStep(1);
  };

  const title = editId ? t('workspace.devices.edit_title') : t('workspace.shell.add_device');
  const steps = [t('workspace.devices.step_type'), t('workspace.devices.step_connection'), t('workspace.devices.step_name')];
  const error = stepError ?? (form.formError || null);

  return (
    <div className={styles.layer} data-phone={isPhone || undefined}>
      {!isPhone && <div className={styles.backdrop} onClick={close} aria-hidden="true" />}
      <div
        ref={contentRef}
        className={styles.dialog}
        data-phone={isPhone || undefined}
        data-wide={(step === 3 && !isPhone) || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {isPhone ? (
          <div className={styles.phoneBar}>
            {step === (editId ? 2 : 1) && !saved ? (
              <button type="button" className={styles.barButton} onClick={close}>{t('common.cancel')}</button>
            ) : (
              <button type="button" className={styles.barButton} onClick={back}>
                <UiIcon name="back" size={20} />
                {t('common.back')}
              </button>
            )}
            <span className={styles.barTitle}>
              <strong>{title}</strong>
              <span>{t('workspace.devices.step_of', { n: step })}</span>
            </span>
          </div>
        ) : (
          <div className={styles.dialogHead}>
            <h2 className={styles.dialogTitle}>{title}</h2>
            <ol className={styles.stepper} aria-label={t('workspace.devices.steps')}>
              {steps.map((label, i) => {
                const n = (i + 1) as Step;
                const done = n < step || (n === 3 && !!saved);
                return (
                  <li key={label} className={styles.stepItem} data-done={done || undefined} data-current={n === step || undefined} aria-current={n === step ? 'step' : undefined}>
                    <span className={styles.stepDot}>{done ? <UiIcon name="check" size={14} /> : n}</span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
            <button type="button" className={styles.close} onClick={close} aria-label={t('common.close')}>
              <UiIcon name="close" size={20} />
            </button>
          </div>
        )}

        <NumberInputScope scope={form.numbers}>
          <div className={styles.dialogBody}>
            {step === 1 && (
              <TypeStep
                value={form.formType}
                onPick={(type, go) => {
                  form.set('formType', type);
                  if (go) setStep(2);
                }}
              />
            )}
            {step === 2 && <ConnectionStep form={form} sources={sources} />}
            {step === 3 && <NameStep form={form} sources={sources} saved={saved} retrying={retrying} />}
            {error && <p className={styles.formError} role="alert">{error}</p>}
          </div>
          <Footer
            form={form}
            step={step}
            editing={!!editId}
            saved={saved}
            retrying={retrying}
            onBack={back}
            onCancel={close}
            onNext={next}
            onSave={() => void save()}
            onTryAgain={() => void tryAgain()}
            onAddAnother={addAnother}
            onOpen={() => {
              onClose();
              if (saved) void navigate(`/source/${saved.id}`);
            }}
            onDone={onClose}
          />
        </NumberInputScope>
      </div>
    </div>
  );
}

function NameStep({ form, sources, saved, retrying }: { form: SourceForm; sources: DashboardSource[]; saved: DashboardSource | null; retrying: boolean }) {
  const isPhone = useIsPhone();
  return (
    <div className={styles.nameStep} data-phone={isPhone || undefined}>
      <NameFields form={form} sources={sources} locked={!!saved} />
      {saved && <SavedResult saved={saved} autoConnect={autoConnectOf(form)?.checked ?? true} retrying={retrying} />}
    </div>
  );
}

/** Mounted only once saved: its status read is the one read after Save. */
function SavedResult({ saved, autoConnect, retrying }: { saved: DashboardSource; autoConnect: boolean; retrying: boolean }) {
  const result = useConnectResult(saved, autoConnect);
  return <ConnectResult saved={saved} result={result} retrying={retrying} />;
}

interface FooterProps {
  form: SourceForm;
  step: Step;
  editing: boolean;
  saved: DashboardSource | null;
  retrying: boolean;
  onBack(): void;
  onCancel(): void;
  onNext(): void;
  onSave(): void;
  onTryAgain(): void;
  onAddAnother(): void;
  onOpen(): void;
  onDone(): void;
}

function Footer(p: FooterProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const first = p.step === (p.editing ? 2 : 1);
  let actions: ReactNode;
  if (p.saved) {
    actions = <SavedActions {...p} saved={p.saved} />;
  } else if (p.step === 3) {
    actions = (
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={p.form.formSaving || p.form.numbers.invalid} onClick={p.onSave}>
        {p.form.formSaving ? t('common.saving') : t('common.save')}
      </button>
    );
  } else if (p.step === 1 && isPhone) {
    // Phone: a type row goes straight on.
    return null;
  } else {
    actions = (
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={p.step === 2 && p.form.numbers.invalid} onClick={p.onNext}>
        {t('common.next')}
      </button>
    );
  }
  return (
    <div className={styles.dialogFoot} data-phone={isPhone || undefined}>
      {!isPhone && p.step === 1 && <p className={styles.footNote}>{t('workspace.devices.admins_note')}</p>}
      {!isPhone && (!first || p.saved) && (
        <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={p.onBack}>
          {t('common.back')}
        </button>
      )}
      <span className={styles.spacer} />
      {!isPhone && !p.saved && (
        <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={p.onCancel} disabled={p.form.formSaving}>
          {t('common.cancel')}
        </button>
      )}
      {actions}
    </div>
  );
}

function SavedActions({ saved, form, retrying, onTryAgain, onAddAnother, onOpen, onDone, onBack }: FooterProps & { saved: DashboardSource }) {
  const { t } = useTranslation();
  const result = useConnectResult(saved, autoConnectOf(form)?.checked ?? true);
  if (result.phase === 'pending' || result.phase === 'connected') {
    return (
      <>
        <button type="button" className={styles.button} onClick={onAddAnother}>{t('workspace.devices.add_another')}</button>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onOpen}>
          {t('workspace.devices.open', { name: saved.name })}
        </button>
      </>
    );
  }
  // Today's /connect does not take an MQTT broker (it listens from the moment it is saved).
  const canConnect = saved.type !== 'mqtt_broker';
  return (
    <>
      <button type="button" className={styles.button} onClick={onBack}>{t('workspace.devices.edit_connection')}</button>
      <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={onDone}>{t('workspace.devices.save_anyway')}</button>
      {canConnect && (
        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={retrying} aria-busy={retrying || undefined} onClick={onTryAgain}>
          <UiIcon name="refresh" size={16} />
          {retrying ? t('source.connecting') : result.phase === 'idle' ? t('source.connect') : t('workspace.devices.try_again')}
        </button>
      )}
    </>
  );
}
