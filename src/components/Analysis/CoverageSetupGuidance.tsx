/**
 * CoverageSetupGuidance — the Coverage Report's collapsible "Setup guidance"
 * panel, moved verbatim out of `CoverageReport.tsx` (Rule X, #6365) so the
 * Workspace Coverage page shows the same panel. It sends nothing.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import styles from './CoverageReport.module.css';

/** Docs section the setup guidance links to (#5591). The anchor is the
 *  "Why a survey looks sparse" heading in docs/features/coverage-report.md. */
const COVERAGE_SPARSE_DOCS_URL =
  'https://meshmonitor.org/features/coverage-report#why-a-survey-looks-sparse';

/** The Meshtastic hop_limit / airtime-cost table (spec §0), shown in the
 *  collapsible setup guidance panel. Multipliers are the spec's own rough
 *  per-fix transmission-count estimates. */
const AIRTIME_ROWS: Array<{ hopLimit: number; txPerFix: string; perHourPct: string }> = [
  { hopLimit: 0, txPerFix: '1', perHourPct: '~2%' },
  { hopLimit: 1, txPerFix: '2-4', perHourPct: '~4-8%' },
  { hopLimit: 3, txPerFix: '4-8', perHourPct: '~8-16%' },
];

/** MeshCore per-advert airtime table (COVERAGE_P3_SPEC.md §0.3), shown in a
 *  MeshCore-specific block in the setup guidance panel below the Meshtastic
 *  table. Advert size ranges 111-135 bytes (short name to a full 32-char
 *  name); figures are the spec's own Semtech-formula computations. */
const MESHCORE_AIRTIME_ROWS: Array<{ preset: string; b111: string; b123: string; b135: string }> = [
  { preset: 'US/Canada 910.525 MHz, SF7 BW62.5 CR5', b111: '396 ms', b123: '426 ms', b135: '467 ms' },
  { preset: 'EU/UK narrow, SF8 BW62.5 CR8', b111: '1.07 s', b123: '1.16 s', b135: '1.26 s' },
  { preset: 'Legacy EU, SF11 BW250 CR5', b111: '1.09 s', b123: '1.17 s', b135: '1.26 s' },
];

export function CoverageSetupGuidance() {
  const { t } = useTranslation();
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  return (
    <div className="reports-panel">
      <button
        type="button"
        className="reports-btn reports-btn--ghost"
        onClick={() => setGuidanceOpen((o) => !o)}
        aria-expanded={guidanceOpen}
      >
        <UiIcon name={guidanceOpen ? 'chevronUp' : 'chevronDown'} size={14} />
        {t('analysis.coverage.guidance_toggle', 'Setup guidance')}
      </button>
      {guidanceOpen && (
        <div className={styles.guidance}>
          <p>
            {t(
              'analysis.coverage.guidance_recommend',
              'Recommended survey-node settings: hop_limit 0, smart position enabled (it honours hop_limit 0), and a smart position minimum interval of 30 seconds or more. 30 seconds needs a private channel: on a default channel the firmware raises it to 5 minutes.',
            )}
          </p>
          {/* #5591: one hint, one docs link. No control here changes a
             node — this report sends nothing. */}
          <p data-testid="coverage-sparse-hint">
            {t(
              'analysis.coverage.guidance_sparse_hint',
              'Fewer dots than you expected? Firmware holds back and drops position packets.',
            )}{' '}
            <a
              className={styles.guidanceLink}
              href={COVERAGE_SPARSE_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('analysis.coverage.guidance_sparse_link', 'Why a survey looks sparse')}
            </a>
          </p>
          <p>
            {t(
              'analysis.coverage.guidance_firmware_caveat',
              'Receiver firmware caveat: a receiving node only keeps a zero-hop (hop_limit 0) packet on firmware 2.7.20 or later — older firmware drops packets with hop_start == 0 before decrypting them. If any receiver in your mesh runs older firmware, use hop_limit 1 instead. Direct copies still show as 0 hops, but each neighbour rebroadcasts once, which costs more airtime.',
            )}
          </p>
          <table className={styles.airtimeTable}>
            <thead>
              <tr>
                <th>{t('analysis.coverage.guidance_col_hop_limit', 'hop_limit')}</th>
                <th>{t('analysis.coverage.guidance_col_tx_per_fix', 'Tx per fix')}</th>
                <th>{t('analysis.coverage.guidance_col_pct_per_hour', '% of channel/hour (30s interval)')}</th>
              </tr>
            </thead>
            <tbody>
              {AIRTIME_ROWS.map((row) => (
                <tr key={row.hopLimit}>
                  <td>{row.hopLimit}</td>
                  <td>{row.txPerFix}</td>
                  <td>{row.perHourPct}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* MeshCore block (#5277 P3 WP3, spec §2.6 / user decision U2):
             a survey advert is a manual, one-shot broadcast, not a timed
             background send like Meshtastic's position packets — so the
             guidance here is about HOW to send one safely, not a setting
             to change on the node. */}
          <h4 className={styles.guidanceSubheading}>
            {t('analysis.coverage.meshcore_guidance_title', 'MeshCore')}
          </h4>
          <p>
            {t(
              'analysis.coverage.meshcore_guidance_zero_hop',
              'Send zero-hop adverts only, one every 60 seconds or slower. Never flood adverts for a survey: every repeater within 8 hops repeats each flood advert.',
            )}
          </p>
          <p>
            {t(
              'analysis.coverage.meshcore_guidance_how_to_send',
              'To send a zero-hop advert: in the companion app, use its advert action and pick the zero-hop option, not flood. On a repeater used as a survey node, use the CLI command advert.zerohop, not advert (which floods).',
            )}
          </p>
          <p>
            {t(
              'analysis.coverage.meshcore_guidance_button_floods',
              "MeshMonitor's own Send advert button floods. Don't use it for surveys.",
            )}
          </p>
          <p>
            {t(
              'analysis.coverage.meshcore_guidance_stored_position',
              "An advert carries the node's stored advert position, not a live GPS fix. Update the node's location before each advert.",
            )}
          </p>
          <table className={styles.airtimeTable}>
            <thead>
              <tr>
                <th>{t('analysis.coverage.meshcore_guidance_col_preset', 'Preset')}</th>
                <th>{t('analysis.coverage.meshcore_guidance_col_111', '111 B')}</th>
                <th>{t('analysis.coverage.meshcore_guidance_col_123', '123 B')}</th>
                <th>{t('analysis.coverage.meshcore_guidance_col_135', '135 B')}</th>
              </tr>
            </thead>
            <tbody>
              {MESHCORE_AIRTIME_ROWS.map((row) => (
                <tr key={row.preset}>
                  <td>{row.preset}</td>
                  <td>{row.b111}</td>
                  <td>{row.b123}</td>
                  <td>{row.b135}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {t(
              'analysis.coverage.meshcore_guidance_survey_pct',
              'A survey sending one zero-hop advert every 60 seconds uses about 0.7% of the local channel on the US preset, up to 1.9% on EU narrow.',
            )}
          </p>
          <p className={styles.guidanceFooter}>
            {t(
              'analysis.coverage.meshcore_guidance_repeaters_auto',
              "Repeaters' own adverts are recorded automatically. MeshMonitor never sends adverts for you.",
            )}
          </p>

          <p className={styles.guidanceFooter}>
            {t(
              'analysis.coverage.guidance_no_send',
              'MeshMonitor sends nothing for this report and never changes the survey node — it only records position packets the node already received.',
            )}
          </p>
        </div>
      )}
    </div>
  );
}
