/**
 * Settings › Console: a remote target's console (Task 7.3,
 * RepeaterConsoleCategory), or this radio's serial CLI (Task 7.4, note s8n4),
 * today's MeshCoreLocalConsole with its catalogue, danger guard and
 * receive-only note. A command goes over the radio's connection; the ones
 * that transmit say so in today's console.
 */
import { MeshCoreLocalConsole } from '../../../components/MeshCore/MeshCoreLocalConsole';
import type { CategoryProps } from '../../settings/categories';
import RepeaterConsoleCategory from '../remote/RepeaterConsoleCategory';
import { useMeshCoreTarget } from '../remote/remoteTarget';
import { McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

export default function ConsoleCategory(props: CategoryProps) {
  const target = useMeshCoreTarget();
  return target ? <RepeaterConsoleCategory {...props} /> : <LocalConsole sourceId={props.sourceId} />;
}

function LocalConsole({ sourceId }: { sourceId: string }) {
  const d = useMcDevice();
  return (
    <McPage>
      <div className={styles.section}>
        <MeshCoreLocalConsole
          sourceId={sourceId}
          deviceName={d.local?.name}
          deviceType={d.local?.advType}
          firmwareVer={d.local?.firmwareVer}
          connected={d.connected}
          actions={{ sendLocalCliCommand: d.actions.sendLocalCliCommand }}
          receiveOnly={d.receiveOnly}
        />
      </div>
    </McPage>
  );
}
