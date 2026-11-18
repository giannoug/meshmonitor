/** Section 8's MeshCore public keys (64 hex chars from a readable seed), shared by the MeshCore fixtures. */
const key = (seed: string) => (seed + '0'.repeat(64)).slice(0, 64);

export const MC = {
  self: key('c0ffee11'),
  lycabettus: key('3fa1aa22'),
  penteli: key('a7f1bb33'),
  parnitha: key('9b02cc44'),
  athensRoom: key('7c22dd55'),
  kifisia: key('3c90ee66'),
  psychiko: key('51d0ff77'),
  glyfada: key('6a1b0188'),
  nikos: key('b44e0299'),
  marousi: key('d81303aa'),
  weather: key('91de0abb'),
} as const;
