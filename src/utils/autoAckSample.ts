/**
 * Auto-Acknowledge's sample preview: a template with each token replaced by an
 * example value. Moved as is from AutoAcknowledgeSection (Task 8.3, Rule X) so
 * the Workspace page shows the same preview.
 */
import { formatDate, formatTime } from './datetime.js';
import type { DateFormat, TimeFormat } from '../contexts/SettingsContext.js';

export function autoAckSampleMessage(
  template: string,
  isDirect: boolean,
  { dateFormat, timeFormat }: { dateFormat: DateFormat; timeFormat: TimeFormat },
): string {
  let sample = template;

  // Replace with sample values
  const now = new Date();
  sample = sample.replace(/{NODE_ID}/g, '!a1b2c3d4');
  sample = sample.replace(/{NUMBER_HOPS}/g, isDirect ? '0' : '3');
  sample = sample.replace(/{HOPS}/g, isDirect ? '0' : '3');
  sample = sample.replace(/{RABBIT_HOPS}/g, isDirect ? '🎯' : '🐇🐇🐇'); // 🎯 for direct, 3 rabbits for 3 hops
  sample = sample.replace(/{DATE}/g, formatDate(now, dateFormat));
  sample = sample.replace(/{TIME}/g, formatTime(now, timeFormat));
  sample = sample.replace(/{VERSION}/g, '2.9.1');
  sample = sample.replace(/{DURATION}/g, '3d 12h');
  sample = sample.replace(/{LONG_NAME}/g, 'Meshtastic ABC1');
  sample = sample.replace(/{SHORT_NAME}/g, 'ABC1');

  // Check which features would be shown
  const sampleFeatures: string[] = [];
  sampleFeatures.push('🗺️'); // Traceroute
  sampleFeatures.push('🤖'); // Auto-ack
  sampleFeatures.push('📢'); // Auto-announce
  sampleFeatures.push('👋'); // Auto-welcome
  sampleFeatures.push('🏓'); // Auto-ping
  sampleFeatures.push('🔑'); // Auto-key management
  sampleFeatures.push('💬'); // Auto-responder
  sampleFeatures.push('⏱️'); // Timed triggers
  sampleFeatures.push('📍'); // Geofence triggers
  sampleFeatures.push('🔍'); // Remote admin scan
  sampleFeatures.push('🕐'); // Auto time sync
  sample = sample.replace(/{FEATURES}/g, sampleFeatures.join(' '));

  sample = sample.replace(/{NODECOUNT}/g, '42');
  sample = sample.replace(/{DIRECTCOUNT}/g, '8');
  sample = sample.replace(/{TOTALNODES}/g, '156');
  sample = sample.replace(/{SNR}/g, '7.5');
  sample = sample.replace(/{RSSI}/g, '-95');
  sample = sample.replace(/{TRANSPORT}/g, 'LoRa'); // Sample transport type
  sample = sample.replace(/{LAST_HOP}/g, isDirect ? 'unknown' : 'RLY1'); // Relay short name (no relay on direct)

  return sample;
}

/** Auto Welcome's sample preview, moved as is from AutoWelcomeSection (Task 8.3, Rule X). */
export function autoWelcomeSampleMessage(message: string): string {
  let sample = message;

  // Replace with sample values
  sample = sample.replace(/{LONG_NAME}/g, 'Meshtastic ABC1');
  sample = sample.replace(/{SHORT_NAME}/g, 'ABC1');
  sample = sample.replace(/{VERSION}/g, '2.10.0');
  sample = sample.replace(/{DURATION}/g, '2d 5h');
  sample = sample.replace(/{FEATURES}/g, '🗺️ 🤖 📢 👋 🏓 🔑 💬 ⏱️ 📍 🔍 🕐');
  sample = sample.replace(/{NODECOUNT}/g, '15');
  sample = sample.replace(/{DIRECTCOUNT}/g, '3');
  sample = sample.replace(/{TOTALNODES}/g, '156');

  return sample;
}
