/**
 * Shared bits of the node page tests (boards f4, f5, g4, g5, 15-02…15-17):
 * the routes and the one fixture no default can carry, Kifisia Rooftop's
 * detected renumbering (a default would turn on Merge identity for the
 * NodeActionMenus tests, which assert it is off).
 */
import { SOURCE_IDS } from '../../__fixtures__/athens';

export const g2 = `/source/${SOURCE_IDS.g2}`;
export const kifisia = `${g2}/node/!a1b2c301`;
export const rover = `${g2}/node/!a1b2c302`;

const side = (nodeNum: number, nodeId: string) => ({ nodeNum, nodeId, longName: 'Kifisia Rooftop', shortName: 'KFR' });

/** Kifisia Rooftop reported as !7e01b2c4 until a 2.8 upgrade (15-03's "New node number"). */
export const renumberedFixtures = {
  'GET /api/nodes/identity-changes': () => ({
    success: true,
    data: {
      sourceId: SOURCE_IDS.g2,
      detections: [{
        successor: side(0xa1b2c301, '!a1b2c301'),
        predecessor: side(0x7e01b2c4, '!7e01b2c4'),
        basis: 'derivedNodeNum', confidence: 'high', derivedFromPredecessorKey: true,
        successorNodeNumIsKeyDerived: true, predecessorNodeNumIsKeyDerived: false, publicKeyMatches: true,
        nameMatches: true, hwModelMatches: true, successorFirmwareIs28OrLater: true,
        predecessorQuietForSeconds: 5 * 86_400, handoverGapSeconds: 600, otherCandidateCount: 0,
      }],
    },
  }),
};
