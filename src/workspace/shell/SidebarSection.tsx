/** A collapsible sidebar group ("▾ Channels" on board a-chat-D-desktop). */
import { useId, useState, type ReactNode } from 'react';
import { UiIcon } from '../../components/icons';
import styles from './SidebarSection.module.css';

export default function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
        {title}
      </button>
      {open && <div id={id}>{children}</div>}
    </section>
  );
}
