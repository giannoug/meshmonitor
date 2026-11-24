/**
 * News (boards 17-09 / 17-16, Task 9.2): today's news popup (NewsPopup's
 * logic, `useNewsPopup`, Rule X) drawn as a Workspace sheet.
 *
 * - Opening reads today's feed (and, signed in, the news status) once; no
 *   interval. Previous / Next page through the items; Next on the last item
 *   reads Close, as today.
 * - Closing it (Close on the last item, ×, Esc or the backdrop) dismisses
 *   every item it showed, Important ones included, unless `forceShowAll`
 *   (Help & about › Show all news), which dismisses nothing.
 */
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { newsMarkdownComponents, useNewsPopup } from '../../components/NewsPopup/useNewsPopup';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './NewsSheet.module.css';

export interface NewsSheetProps {
  isOpen: boolean;
  onClose(): void;
  forceShowAll?: boolean;
  isAuthenticated: boolean;
}

export default function NewsSheet({ isOpen, onClose, forceShowAll = false, isAuthenticated }: NewsSheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const phone = isPhone || undefined;
  const n = useNewsPopup({ isOpen, onClose, forceShowAll, isAuthenticated });
  const close = () => void n.handleClose();
  // Today scrolls the popup's body to the top on a page turn; here the sheet's body is the scroller.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.parentElement?.scrollTo?.({ top: 0 });
  }, [n.currentIndex]);
  const item = n.loading ? undefined : n.newsItems[n.currentIndex];
  const isLast = n.currentIndex === n.newsItems.length - 1;

  const title = (
    <span className={styles.title}>
      {t('news.title', 'News')}
      {item && n.newsItems.length > 1 && (
        <span className={styles.count}>
          {n.currentIndex + 1} / {n.newsItems.length}
        </span>
      )}
    </span>
  );

  const footer = item && (
    <div className={styles.actions} data-phone={phone}>
      {n.currentIndex > 0 && (
        <button type="button" className={styles.button} onClick={n.handlePrevious}>
          {t('news.previous', 'Previous')}
        </button>
      )}
      <button type="button" className={`${styles.button} ${styles.primary}`} onClick={n.handleNext}>
        {isLast ? t('news.close', 'Close') : t('news.next', 'Next')}
      </button>
    </div>
  );

  return (
    <Sheet open={isOpen} onClose={close} title={title} footer={footer}>
      <div className={styles.body} data-phone={phone} ref={bodyRef}>
        {n.loading ? (
          <StateView kind="loading" />
        ) : !item ? (
          <StateView kind="empty" title={t('news.no_news', 'No news at this time.')} />
        ) : (
          <article className={styles.item}>
            <div className={styles.meta}>
              <span className={styles.category} data-category={item.category}>
                {n.getCategoryLabel(item.category)}
              </span>
              {item.priority === 'important' && <span className={styles.important}>{t('news.important', 'Important')}</span>}
              <span className={styles.date}>{n.formatDate(item.date)}</span>
            </div>
            <h3 className={styles.heading}>{item.title}</h3>
            <div className={styles.content}>
              <ReactMarkdown components={newsMarkdownComponents}>{item.content}</ReactMarkdown>
            </div>
          </article>
        )}
      </div>
    </Sheet>
  );
}
