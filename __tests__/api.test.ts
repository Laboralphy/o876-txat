import {
    System,
    Channel,
    TypedEmitter,
    POWERS,
    TXAT_EVENTS,
    CHANNEL_ATTRIBUTES,
    LEAVE_REASONS,
} from '../src';
import type { MessagePostDto, PresenceDto, TxatEventMap } from '../src';

function setup(...idUsers: string[]) {
    const s = new System();
    idUsers.forEach((id) => s.registerUser(id));
    return s;
}

/**
 * Record every system event as "event:recv" (+ reason when any)
 */
function record(s: System) {
    const log: string[] = [];
    for (const event of Object.values(TXAT_EVENTS)) {
        s.events.on(event, (dto) => {
            const reason = 'reason' in dto ? `(${dto.reason})` : '';
            log.push(`${event}:${dto.recv}${reason}`);
        });
    }
    return log;
}

describe('TypedEmitter', () => {
    type Map = { ping: number; pong: string };

    it('should call listeners in subscription order, and report if any', () => {
        const e = new TypedEmitter<Map>();
        const log: string[] = [];
        expect(e.emit('ping', 1)).toBe(false);
        e.on('ping', (n) => log.push(`a${n}`));
        e.on('ping', (n) => log.push(`b${n}`));
        expect(e.emit('ping', 2)).toBe(true);
        expect(log).toEqual(['a2', 'b2']);
    });
    it('should unsubscribe with off', () => {
        const e = new TypedEmitter<Map>();
        const listener = vi.fn();
        e.on('pong', listener);
        e.off('pong', listener);
        e.emit('pong', 'x');
        expect(listener).not.toHaveBeenCalled();
        expect(e.listenerCount('pong')).toBe(0);
    });
    it('should call a once listener only one time', () => {
        const e = new TypedEmitter<Map>();
        const listener = vi.fn();
        e.once('ping', listener);
        e.emit('ping', 1);
        e.emit('ping', 2);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(1);
    });
    it('should remove all listeners of one event or of every event', () => {
        const e = new TypedEmitter<Map>();
        e.on('ping', () => {});
        e.on('pong', () => {});
        e.removeAllListeners('ping');
        expect(e.listenerCount('ping')).toBe(0);
        expect(e.listenerCount('pong')).toBe(1);
        e.removeAllListeners();
        expect(e.listenerCount('pong')).toBe(0);
    });
    it('should type event payloads', () => {
        const s = new System();
        s.events.on(TXAT_EVENTS.MESSAGE_POST, (dto) => {
            expectTypeOf(dto).toEqualTypeOf<MessagePostDto>();
        });
        expectTypeOf<TxatEventMap[TXAT_EVENTS.USER_JOINED]['user']>().toEqualTypeOf<PresenceDto>();
    });
});

describe('string enums', () => {
    it('should expose readable values', () => {
        expect(POWERS.READ).toBe('read');
        expect(CHANNEL_ATTRIBUTES.PERSISTENT).toBe('persistent');
        expect(LEAVE_REASONS.KICKED).toBe('kicked');
    });
});

describe('messages', () => {
    it('should have a unique id and a channel reference', () => {
        const s = setup('u1');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        const m1 = s.postMessage('u1', 'c1', 'hello');
        const m2 = s.postMessage('u1', 'c1', 'hello');
        expect(m1.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
        expect(m1.id).not.toBe(m2.id);
        expect(m1.idChannel).toBe('c1');
        expect(s.getChannel('c1').getMessages()).toEqual([m1, m2]);
    });
});

describe('event payloads', () => {
    it('should be plain, serializable snapshots', () => {
        const s = setup('u1', 'u2');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        const presence = s.getChannel('c1').getUser('u1');
        presence!.color = 'red';
        const received: MessagePostDto[] = [];
        s.events.on(TXAT_EVENTS.MESSAGE_POST, (dto) => received.push(dto));
        s.postMessage('u1', 'c1', 'hi');
        presence!.revoke(POWERS.WRITE); // later changes must not alter emitted payloads

        const dto = received[0]!;
        expect(JSON.parse(JSON.stringify(dto))).toEqual({
            recv: 'u1',
            idChannel: 'c1',
            user: { id: 'u1', color: 'red', powers: ['read', 'write'] },
            message: {
                id: dto.message.id,
                idChannel: 'c1',
                idUser: 'u1',
                content: 'hi',
                ts: dto.message.ts,
            },
        });
    });
    it('should be emitted by a standalone channel too', () => {
        const c = new Channel('c1');
        const log: string[] = [];
        c.events.on(TXAT_EVENTS.YOU_JOINED, ({ recv, idChannel }) =>
            log.push(`${recv}@${idChannel}`)
        );
        c.addUser('u1');
        expect(log).toEqual(['u1@c1']);
    });
});

describe('ban / unban', () => {
    it('should kick a present user when banned, and keep them out', () => {
        const s = setup('u1', 'u2');
        const c1 = s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        const log = record(s);
        c1.ban('u2');
        expect(log).toEqual(['you.left:u2(kicked)', 'user.left:u1(kicked)']);
        expect(c1.getUser('u2')).toBeUndefined();
        expect(s.getUser('u2').joinedChannels.has(c1)).toBe(false);
        expect(() => s.userJoinChannel('u2', 'c1')).toThrow();
    });
    it('should let a user join again once unbanned', () => {
        const s = setup('u1', 'u2');
        const c1 = s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        c1.ban('u2');
        c1.unban('u2');
        expect(() => s.userJoinChannel('u2', 'c1')).not.toThrow();
    });
    it('should remove a non-persistent channel when its last user is banned', () => {
        const s = setup('u1');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.getChannel('c1').ban('u1');
        expect(s.isChannelExists('c1')).toBe(false);
    });
});

describe('allow / disallow', () => {
    it('should make the channel private and kick users not allowed', () => {
        const s = setup('u1', 'u2');
        const c1 = s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        c1.allow('u1');
        expect(c1.private).toBe(true);
        expect(c1.users.map((u) => u.id)).toEqual(['u1']);
        expect(() => s.userJoinChannel('u2', 'c1')).toThrow();
    });
    it('should kick a present user removed from the white list', () => {
        const s = setup('u1', 'u2');
        const c1 = s.addChannel('c1');
        c1.allow('u1');
        c1.allow('u2');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        c1.disallow('u2');
        expect(c1.users.map((u) => u.id)).toEqual(['u1']);
        expect(s.getUser('u2').joinedChannels.has(c1)).toBe(false);
    });
});

describe('kick', () => {
    it('should remove the user with a kicked reason, and let them join again', () => {
        const s = setup('u1', 'u2');
        const c1 = s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        const log = record(s);
        c1.kick('u2');
        expect(log).toEqual(['you.left:u2(kicked)', 'user.left:u1(kicked)']);
        expect(s.getUser('u2').joinedChannels.has(c1)).toBe(false);
        expect(() => s.userJoinChannel('u2', 'c1')).not.toThrow();
    });
});

describe('leaving', () => {
    it('should notify a voluntary leave with a left reason', () => {
        const s = setup('u1', 'u2');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        s.userJoinChannel('u2', 'c1');
        const log = record(s);
        s.userLeaveChannel('u2', 'c1');
        expect(log).toEqual(['you.left:u2(left)', 'user.left:u1(left)']);
    });
    it('should throw when the user is not on the channel', () => {
        const s = setup('u1', 'u2');
        s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        expect(() => s.userLeaveChannel('u2', 'c1')).toThrow(/not on channel/);
        expect(() => s.getChannel('c1').removeUser('u2')).toThrow(/not on channel/);
    });
});

describe('removeChannel', () => {
    it('should detach the system listeners from the removed channel', () => {
        const s = setup('u1');
        const c1 = s.addChannel('c1');
        s.removeChannel('c1');
        for (const event of Object.values(TXAT_EVENTS)) {
            expect(c1.events.listenerCount(event)).toBe(0);
        }
    });
});

describe('listener errors', () => {
    type Map = { ping: number };

    it('should call the remaining listeners when one throws, and report the error', () => {
        const onError = vi.fn();
        const e = new TypedEmitter<Map>({ onError });
        const log: string[] = [];
        const error = new Error('boom');
        e.on('ping', () => log.push('a'));
        e.on('ping', () => {
            throw error;
        });
        e.on('ping', () => log.push('c'));
        expect(() => e.emit('ping', 1)).not.toThrow();
        expect(log).toEqual(['a', 'c']);
        expect(onError).toHaveBeenCalledWith(error, 'ping', 1);
    });
    it('should report a rejected async listener', async () => {
        const e = new TypedEmitter<Map>();
        const onError = vi.fn();
        e.onError = onError;
        const error = new Error('async boom');
        e.on('ping', async () => {
            throw error;
        });
        e.emit('ping', 2);
        await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error, 'ping', 2));
    });
    it('should log to console.error by default', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const e = new TypedEmitter<Map>();
        e.on('ping', () => {
            throw new Error('boom');
        });
        e.emit('ping', 1);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
    it('should not break the emit loop when the error handler itself throws', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const e = new TypedEmitter<Map>({
            onError: () => {
                throw new Error('handler failure');
            },
        });
        const log: string[] = [];
        e.on('ping', () => {
            throw new Error('boom');
        });
        e.on('ping', () => log.push('b'));
        expect(() => e.emit('ping', 1)).not.toThrow();
        expect(log).toEqual(['b']);
        spy.mockRestore();
    });
    it('should deliver a message to every recipient even if delivery to one fails', () => {
        const s = setup('u1', 'u2', 'u3');
        const errors: unknown[] = [];
        s.events.onError = (error) => errors.push(error);
        s.addChannel('c1');
        ['u1', 'u2', 'u3'].forEach((id) => s.userJoinChannel(id, 'c1'));
        const delivered: string[] = [];
        s.events.on(TXAT_EVENTS.MESSAGE_POST, ({ recv }) => {
            if (recv === 'u1') {
                throw new Error('socket closed');
            }
            delivered.push(recv);
        });
        expect(() => s.postMessage('u1', 'c1', 'hi')).not.toThrow();
        expect(delivered).toEqual(['u2', 'u3']);
        expect(errors).toHaveLength(1);
        expect(s.getChannel('c1').getMessages()).toHaveLength(1);
    });
});
