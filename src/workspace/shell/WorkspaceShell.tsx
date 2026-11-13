/**
 * The Workspace frame (spec §5.3). Task 1.6 adds the device rail and sidebar;
 * until then it is the frame that pages render in.
 *
 * Not yet here (Tasks 1.6/1.7): sign-in, the user menu and the connection
 * chip. The re-hosted pages hide their own topbars, which carried them.
 */
import type { ReactNode } from 'react';
import styles from './WorkspaceShell.module.css';

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell} data-workspace-shell="">
      {/* A div, not <main>: re-hosted pages bring their own <main>. */}
      <div className={styles.main}>{children}</div>
    </div>
  );
}
