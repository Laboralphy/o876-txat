import { System, POWERS, TXAT_EVENTS, CHANNEL_ATTRIBUTES } from '../src';

function setup(...idUsers: string[]) {
    const s = new System();
    idUsers.forEach((id) => s.registerUser(id));
    return s;
}

describe('non-persistent channel auto-removal', () => {
    it('should remove a non-persistent channel when its last user leaves', () => {
        const s = setup('u1');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userLeaveChannel('u1', 'c1');
        expect(s.isChannelExists('c1')).toBe(false);
    });
    it('should keep a non-persistent channel while users remain', () => {
        const s = setup('u1', 'u2');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        s.userLeaveChannel('u1', 'c1');
        expect(s.isChannelExists('c1')).toBe(true);
    });
    it('should keep a persistent channel when its last user leaves', () => {
        const s = setup('u1');
        s.addChannel('c1').attributes.add(CHANNEL_ATTRIBUTES.PERSISTENT);
        s.userJoinChannel('u1', 'c1');
        s.userLeaveChannel('u1', 'c1');
        expect(s.isChannelExists('c1')).toBe(true);
    });
    it('should remove a non-persistent channel when its last user is unregistered', () => {
        const s = setup('u1');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.unregisterUser('u1');
        expect(s.isChannelExists('c1')).toBe(false);
    });
    it('should remove the former tagged channel when its last user switches channel', () => {
        const s = setup('u1');
        s.addChannel('room1', { tag: 'room' });
        s.addChannel('room2', { tag: 'room' });
        s.userJoinChannel('u1', 'room1');
        s.userJoinChannel('u1', 'room2');
        expect(s.isChannelExists('room1')).toBe(false);
        expect(s.isChannelExists('room2')).toBe(true);
    });
});

describe('removeChannel', () => {
    it('should notify, then detach every user from the removed channel', () => {
        const s = setup('u1', 'u2');
        const c1 = s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        const closed: string[] = [];
        s.events.on(TXAT_EVENTS.CLOSED, ({ recv, idChannel }) =>
            closed.push(`${recv}@${idChannel}`)
        );
        s.removeChannel('c1');
        expect(closed).toEqual(['u1@c1', 'u2@c1']);
        expect(c1.users).toEqual([]);
        expect(s.getUser('u1').joinedChannels.has(c1)).toBe(false);
        expect(s.getUser('u2').joinedChannels.has(c1)).toBe(false);
    });
    it('should not block joining another channel with the same tag afterwards', () => {
        const s = setup('u1');
        s.addChannel('room1', { tag: 'room' });
        s.addChannel('room2', { tag: 'room' });
        s.userJoinChannel('u1', 'room1');
        s.removeChannel('room1');
        expect(() => s.userJoinChannel('u1', 'room2')).not.toThrow();
        expect(s.getUser('u1').joinedChannels.size).toBe(1);
    });
});

describe('userJoinChannel ordering', () => {
    it('should not leave the former tagged channel when joining the new one is denied', () => {
        const s = setup('u1');
        const room1 = s.addChannel('room1', { tag: 'room' });
        s.addChannel('room2', { tag: 'room' }).ban('u1');
        s.userJoinChannel('u1', 'room1');
        expect(() => s.userJoinChannel('u1', 'room2')).toThrow();
        expect(room1.getUser('u1')).toBeDefined();
        expect(s.getUser('u1').joinedChannels.has(room1)).toBe(true);
    });
    it('should emit YOU_JOINED once the user is present and powered', () => {
        const s = setup('u1');
        s.addChannel('c1');
        let seen: { present: boolean; read?: boolean; write?: boolean } | undefined;
        s.events.on(TXAT_EVENTS.YOU_JOINED, ({ recv, idChannel }) => {
            const channel = s.getChannel(idChannel);
            const presence = channel.getUser(recv);
            seen = {
                present: channel.users.some((u) => u.id === recv),
                read: presence?.hasPower(POWERS.READ),
                write: presence?.hasPower(POWERS.WRITE),
            };
        });
        s.userJoinChannel('u1', 'c1');
        expect(seen).toEqual({ present: true, read: true, write: true });
    });
    it('should send USER_JOINED to the other users only', () => {
        const s = setup('u1', 'u2', 'u3');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        const log: string[] = [];
        s.events.on(TXAT_EVENTS.USER_JOINED, ({ recv, user }) => log.push(`${user.id}->${recv}`));
        s.userJoinChannel('u3', 'c1');
        expect(log).toEqual(['u3->u1', 'u3->u2']);
    });
});

describe('registerUser', () => {
    it('should refuse to register an already registered user', () => {
        const s = setup('u1');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        expect(() => s.registerUser('u1')).toThrow();
        expect(s.getUser('u1').joinedChannels.size).toBe(1);
    });
});

describe('unregisterUser', () => {
    it('should make the user leave every joined channel', () => {
        const s = setup('u1', 'u2');
        const c1 = s.addChannel('c1');
        const c2 = s.addChannel('c2');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u1', 'c2');
        s.userJoinChannel('u2', 'c1');
        s.unregisterUser('u1');
        expect(c1.getUser('u1')).toBeUndefined();
        expect(c2.getUser('u1')).toBeUndefined();
        expect(s.isChannelExists('c1')).toBe(true);
        expect(s.isChannelExists('c2')).toBe(false);
        expect(s.isUserRegistered('u1')).toBe(false);
    });
});
