/**
 * NewsPopup Component
 *
 * Displays news announcements from meshmonitor.org in a modal popup.
 * Supports markdown content, category badges, pagination, and dismissal.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { newsMarkdownComponents, useNewsPopup } from './useNewsPopup';
import './NewsPopup.css';

interface NewsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  forceShowAll?: boolean;
  isAuthenticated: boolean;
}

export const NewsPopup: React.FC<NewsPopupProps> = ({
  isOpen,
  onClose,
  forceShowAll = false,
  isAuthenticated,
}) => {
  const { t } = useTranslation();
  const {
    newsItems,
    currentIndex,
    loading,
    contentRef,
    handleClose,
    handleNext,
    handlePrevious,
    getCategoryLabel,
    formatDate,
  } = useNewsPopup({ isOpen, onClose, forceShowAll, isAuthenticated });

  if (!isOpen) return null;

  // Show loading state
  if (loading) {
    return (
      <div className="modal-overlay news-modal-overlay" onClick={handleClose}>
        <div className="modal-content news-modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header news-modal-header">
            <h2>{t('news.title', 'News')}</h2>
            <button className="modal-close" onClick={handleClose}>
              &times;
            </button>
          </div>
          <div className="modal-body news-modal-body">
            <div className="news-loading">{t('common.loading', 'Loading...')}</div>
          </div>
        </div>
      </div>
    );
  }

  // No news items
  if (newsItems.length === 0) {
    return (
      <div className="modal-overlay news-modal-overlay" onClick={handleClose}>
        <div className="modal-content news-modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header news-modal-header">
            <h2>{t('news.title', 'News')}</h2>
            <button className="modal-close" onClick={handleClose}>
              &times;
            </button>
          </div>
          <div className="modal-body news-modal-body">
            <div className="news-empty">{t('news.no_news', 'No news at this time.')}</div>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = newsItems[currentIndex];
  const isLastItem = currentIndex === newsItems.length - 1;

  return (
    <div className="modal-overlay news-modal-overlay" onClick={handleClose}>
      <div className="modal-content news-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header news-modal-header">
          <div className="news-header-left">
            <h2>{t('news.title', 'News')}</h2>
            {newsItems.length > 1 && (
              <span className="news-pagination">
                {currentIndex + 1} / {newsItems.length}
              </span>
            )}
          </div>
          <button className="modal-close" onClick={handleClose}>
            &times;
          </button>
        </div>

        <div className="modal-body news-modal-body" ref={contentRef}>
          <div className="news-item">
            <div className="news-item-header">
              <span className={`news-category news-category-${currentItem.category}`}>
                {getCategoryLabel(currentItem.category)}
              </span>
              {currentItem.priority === 'important' && (
                <span className="news-priority-important">
                  {t('news.important', 'Important')}
                </span>
              )}
              <span className="news-date">{formatDate(currentItem.date)}</span>
            </div>

            <h3 className="news-item-title">{currentItem.title}</h3>

            <div className="news-item-content">
              <ReactMarkdown
                components={newsMarkdownComponents}
              >
                {currentItem.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        <div className="modal-footer news-modal-footer">
          {/* Closing the popup marks items as seen by default; the News icon
              re-opens the feed at any time. */}
          <div className="news-footer-left" />

          <div className="news-footer-right">
            {currentIndex > 0 && (
              <button className="news-button news-button-secondary" onClick={handlePrevious}>
                {t('news.previous', 'Previous')}
              </button>
            )}
            <button className="news-button news-button-primary" onClick={handleNext}>
              {isLastItem ? t('news.close', 'Close') : t('news.next', 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsPopup;
