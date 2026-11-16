/**
 * Remote console (boards 12-11, 12-25), a remote-only page: today's Meshtastic
 * CLI console for the remote node on the shared CliConsoleBody (its transcript,
 * input, Send and the typed-name confirm for destructive flags), with the
 * command prefix and what a command sends. A command goes out only when sent
 * (Enter or Send), one request each (useMeshtasticCliRunner); nothing repeats.
 */
import { useTranslation } from 'react-i18next';
import { CliConsoleBody } from '../../../components/MeshCore/CliConsoleBody';
import { useMeshtasticCliRunner } from '../../../components/admin-commands/useMeshtasticCliRunner';
import { MESHTASTIC_DANGER_COMMAND_PATTERN } from '../../../utils/meshtasticCliDanger';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import type { CategoryProps } from '../categories';
import TargetActions from './TargetActions';
import { useRemoteTarget } from './useRemoteTarget';
import styles from './Remote.module.css';

export default function RemoteConsoleCategory({ sourceId, readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const remote = useRemoteTarget();
  const runCommand = useMeshtasticCliRunner(sourceId, remote?.node.nodeId);
  if (!remote) return <StateView kind="noPermission" />;
  const { node } = remote;
  const off = readOnly || remote.blocked;
  const offText = remote.blocked ? t('tx_disabled.remote_admin_notice') : t('admin_commands.cli_console.blocked');
  return (
    <>
      <TargetActions />
      <section className={styles.console} data-phone={isPhone || undefined} aria-label={t('admin_commands.cli_console.title')}>
        <div className={styles.prefixRow}>
          <span className={styles.prefixLabel}>{t('admin_commands.cli_console.prefix_label')}</span>
          <code className={styles.prefix}>{`meshtastic --dest ${node.nodeId}`}</code>
        </div>
        <CliConsoleBody
          targetId={node.nodeId}
          targetName={node.longName || node.nodeId}
          runCommand={runCommand}
          actionCatalog={[]}
          dangerPattern={MESHTASTIC_DANGER_COMMAND_PATTERN}
          disabled={off}
          disabledPlaceholder={off ? offText : undefined}
          placeholder={t('admin_commands.cli_console.input_placeholder')}
          emptyTextEnabled={t('admin_commands.cli_console.empty_enabled')}
          emptyTextDisabled={offText}
        />
        <SendsLine>{t('workspace.settings.remote.console_sends', { name: node.longName })}</SendsLine>
      </section>
    </>
  );
}
