/**
 * DeviceTag: a device's abbreviation in its colour token, read from the shell's
 * device list (no new polling). Renders nothing for an id the viewer cannot
 * read or that is gone, so a tag never names a device the viewer may not see.
 */
import { useShellDevices } from '../shell/shellDevices';
import styles from './DeviceTag.module.css';

export default function DeviceTag({ sourceId }: { sourceId: string }) {
  const device = useShellDevices().sources.find((s) => s.id === sourceId);
  if (!device) return null;
  return (
    <span className={styles.tag} style={{ color: device.colorToken }} title={device.name}>
      {device.abbrev}
    </span>
  );
}
