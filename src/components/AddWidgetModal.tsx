/**
 * AddWidgetModal - Modal for adding new dashboard widgets
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from './icons';
import { WIDGET_OPTIONS, type WidgetType } from './widgetOptions';

export type { WidgetType } from './widgetOptions';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (type: WidgetType) => void;
  /** Widget types to offer; omitted = all. */
  supported?: ReadonlySet<WidgetType>;
}

const AddWidgetModal: React.FC<AddWidgetModalProps> = ({ isOpen, onClose, onAddWidget, supported }) => {
  const { t } = useTranslation();
  const [showTelemetryHelp, setShowTelemetryHelp] = useState(false);

  useEffect(() => {
    if (!isOpen) setShowTelemetryHelp(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAddWidget = (type: WidgetType) => {
    onAddWidget(type);
    onClose();
  };

  return (
    <div className="add-widget-modal-backdrop" onClick={handleBackdropClick}>
      <div className="add-widget-modal">
        <div className="add-widget-modal-header">
          <h2>
            {showTelemetryHelp
              ? t('dashboard.telemetry_help.title')
              : t('dashboard.add_widget')}
          </h2>
          <button className="add-widget-modal-close" onClick={onClose}>
            <UiIcon name="close" />
          </button>
        </div>
        {showTelemetryHelp ? (
          <div className="add-widget-modal-content">
            <p className="add-widget-help-intro">{t('dashboard.telemetry_help.intro')}</p>
            <ol className="add-widget-help-steps">
              <li>{t('dashboard.telemetry_help.step1')}</li>
              <li>{t('dashboard.telemetry_help.step2')}</li>
              <li>{t('dashboard.telemetry_help.step3')}</li>
              <li>{t('dashboard.telemetry_help.step4')}</li>
            </ol>
            <button
              className="add-widget-help-back"
              onClick={() => setShowTelemetryHelp(false)}
            >
              {t('dashboard.telemetry_help.back')}
            </button>
          </div>
        ) : (
          <div className="add-widget-modal-content">
            {WIDGET_OPTIONS.filter(option => !supported || supported.has(option.type)).map(option => (
              <div key={option.type} className="add-widget-option" onClick={() => handleAddWidget(option.type)}>
                <div className="add-widget-option-icon"><UiIcon name={option.icon} /></div>
                <div className="add-widget-option-info">
                  <h3>{t(option.titleKey)}</h3>
                  <p>{t(option.descriptionKey)}</p>
                </div>
              </div>
            ))}
            <div
              className="add-widget-option add-widget-option-more"
              onClick={() => setShowTelemetryHelp(true)}
            >
              <div className="add-widget-option-icon"><UiIcon name="favorite" /></div>
              <div className="add-widget-option-info">
                <h3>{t('dashboard.widget.more.title')}</h3>
                <p>{t('dashboard.widget.more.description')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddWidgetModal;
