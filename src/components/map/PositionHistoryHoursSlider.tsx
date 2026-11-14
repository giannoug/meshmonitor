/**
 * The position-history duration slider (Map controls, Show Position History),
 * moved unchanged from NodesTab (#6365) so the Workspace Layers drawer shows
 * the same control. The top stop is "All" and stores null.
 */
import type { PositionHistoryItem } from '../../contexts/MapContext';

export interface PositionHistoryHoursSliderProps {
  /** The loaded history, oldest first; at least two fixes. */
  positionHistory: PositionHistoryItem[];
  /** MapContext `positionHistoryHours`; null = all. */
  hours: number | null;
  onChange(hours: number | null): void;
}

export function PositionHistoryHoursSlider({ positionHistory, hours, onChange }: PositionHistoryHoursSliderProps) {
  // Calculate max hours from oldest position in history
  const oldestTimestamp = positionHistory[0].timestamp;
  const now = Date.now();
  const maxHours = Math.max(1, Math.ceil((now - oldestTimestamp) / (1000 * 60 * 60)));

  // Current slider value (default to max if not set)
  const currentHours = hours ?? maxHours;

  // Format the display value
  const formatDuration = (value: number, isMax: boolean): string => {
    if (isMax && value === maxHours) return 'All';
    if (value < 24) return `${value}h`;
    const days = Math.floor(value / 24);
    const remainingHours = value % 24;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours}h`;
  };

  return (
    <div className="position-history-slider">
      <input
        type="range"
        min={1}
        max={maxHours}
        value={currentHours}
        aria-label="Position history duration"
        aria-valuemin={1}
        aria-valuemax={maxHours}
        aria-valuenow={currentHours}
        aria-valuetext={formatDuration(currentHours, currentHours >= maxHours)}
        onChange={(e) => {
          const value = parseInt(e.target.value, 10);
          // Set to null if at max (show all)
          onChange(value >= maxHours ? null : value);
        }}
      />
      <span className="slider-value">{formatDuration(currentHours, currentHours >= maxHours)}</span>
    </div>
  );
}

export default PositionHistoryHoursSlider;
