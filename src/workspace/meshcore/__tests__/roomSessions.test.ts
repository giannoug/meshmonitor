/** Room logins belong to the signed-in user: a sign-out or another user drops them (review M4). */
import { describe, it, expect } from 'vitest';
import { ownerOf, roomSessionsFor, setRoomLoggedIn, syncRoomSessionsOwner } from '../roomSessions';

describe('roomSessions', () => {
  it('keeps a login for its user and device only', () => {
    setRoomLoggedIn('1', 'src-a', 'room1', true);
    expect(roomSessionsFor('1', 'src-a').has('room1')).toBe(true);
    expect(roomSessionsFor('1', 'src-b').size).toBe(0);
    expect(roomSessionsFor('2', 'src-a').size).toBe(0);
  });

  it('a sign-out clears every login, and signing back in does not restore them', () => {
    setRoomLoggedIn('1', 'src-a', 'room1', true);
    syncRoomSessionsOwner(null);
    expect(roomSessionsFor(null, 'src-a').size).toBe(0);
    syncRoomSessionsOwner('1');
    expect(roomSessionsFor('1', 'src-a').size).toBe(0);
  });

  it('another user signing in drops the first user\'s logins', () => {
    setRoomLoggedIn('1', 'src-a', 'room1', true);
    setRoomLoggedIn('2', 'src-a', 'room2', true);
    expect(roomSessionsFor('2', 'src-a')).toEqual(new Set(['room2']));
    syncRoomSessionsOwner('1');
    expect(roomSessionsFor('1', 'src-a').size).toBe(0);
  });

  it('owns by user id; a guest is null', () => {
    expect(ownerOf({ id: 7 })).toBe('7');
    expect(ownerOf(null)).toBeNull();
  });
});
