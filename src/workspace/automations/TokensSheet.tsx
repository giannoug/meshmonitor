/**
 * Tokens (s14n4: "Substitutions help is the Tokens link"): today's
 * substitutions reference (SubstitutionsHelp's content) in a kit sheet, from a
 * step's sheet or the Test run. The caller hides its own sheet while this one
 * is open (D9c) and brings it back on close, its draft intact.
 */
import { useTranslation } from 'react-i18next';
import { SubstitutionsReference } from '../../components/automations/SubstitutionsHelp';
import Sheet from '../patterns/Sheet';
import own from './Rules.module.css';

export interface TokensSheetProps {
  open: boolean;
  onClose(): void;
  triggerType: string;
  variables: Array<{ name: string }>;
  stepNames: string[];
}

export default function TokensSheet({ open, onClose, triggerType, variables, stepNames }: TokensSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('workspace.rules.tokens')}>
      <div className={own.tokens}>
        <SubstitutionsReference triggerType={triggerType} variables={variables} stepNames={stepNames} />
      </div>
    </Sheet>
  );
}
