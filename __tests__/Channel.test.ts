import * as Txat from '../src';
import { POWERS } from '../src';
import { TXAT_EVENTS } from '../src';

describe('Txat', () => {
    it('should create an instance without error', () => {
        expect(() => {
            const txat = new Txat.System();
        }).not.toThrow();
    });
});

describe('UserPresence', () => {
    it('should create a user presence without error', () => {
        expect(() => {
            const txat = new Txat.UserPresence('a1');
        }).not.toThrow();
    });
    it('UserPresence grant hasPower', () => {
        const up = new Txat.UserPresence('a1');
        expect(up.hasPower(POWERS.READ)).toBe(false);
        up.grant(POWERS.READ);
        expect(up.hasPower(POWERS.READ)).toBe(true);
    });
    it('UserPresence revoke hasPower', () => {
        const up = new Txat.UserPresence('a1');
        expect(up.hasPower(POWERS.READ)).toBe(false);
        up.grant(POWERS.READ);
        up.grant(POWERS.WRITE);
        expect(up.hasPower(POWERS.READ)).toBe(true);
        expect(up.hasPower(POWERS.WRITE)).toBe(true);
        up.revoke(POWERS.READ);
        expect(up.hasPower(POWERS.READ)).toBe(false);
        expect(up.hasPower(POWERS.WRITE)).toBe(true);
        up.revoke(POWERS.WRITE);
        expect(up.hasPower(POWERS.WRITE)).toBe(false);
        up.revoke(POWERS.WRITE);
        expect(up.hasPower(POWERS.WRITE)).toBe(false);
    });
});

describe('Channel', () => {
    describe('postMessage', () => {
        it('should not be able to post message when user is not in channel', () => {
            const c = new Txat.Channel('c1');
            expect(() => c.postMessage('c1', '***')).toThrow();
        });
        it('should keep the last 5 message when maxLines is set to 5', () => {
            const c = new Txat.Channel('c1');
            c.maxLines = 5;
            c.addUser('u1').grant(POWERS.WRITE).grant(POWERS.READ);
            expect(c.getMessages().length).toBe(0);
            c.postMessage('u1', 'msg1');
            expect(c.getMessages().length).toBe(1);
            expect(c.getMessages()[0]?.content).toBe('msg1');
            c.postMessage('u1', 'msg2');
            expect(c.getMessages().length).toBe(2);
            expect(c.getMessages()[0]?.content).toBe('msg1');
            c.postMessage('u1', 'msg3');
            expect(c.getMessages().length).toBe(3);
            expect(c.getMessages()[0]?.content).toBe('msg1');
            c.postMessage('u1', 'msg4');
            expect(c.getMessages().length).toBe(4);
            expect(c.getMessages()[0]?.content).toBe('msg1');
            c.postMessage('u1', 'msg5');
            expect(c.getMessages().length).toBe(5);
            expect(c.getMessages()[0]?.content).toBe('msg1');
            c.postMessage('u1', 'msg6');
            expect(c.getMessages().length).toBe(5);
            expect(c.getMessages()[0]?.content).toBe('msg2');
            c.postMessage('u1', 'msg7');
            expect(c.getMessages().length).toBe(5);
            expect(c.getMessages()[0]?.content).toBe('msg3');
            c.postMessage('u1', 'msg8');
        });
        it('should not be able to post if user has no write power', () => {
            const c = new Txat.Channel('c1');
            c.addUser('u1', { powers: [] });
            expect(() => c.postMessage('u1', 'msg1')).toThrow();
        });
        it('should be able to receive message only if user has read power', () => {
            const c = new Txat.Channel('c1');
            c.addUser('u1').grant(POWERS.READ).grant(POWERS.WRITE);
            const u2 = c.addUser('u2');
            u2.grant(POWERS.READ);
            const log: string[] = [];

            c.events.on(TXAT_EVENTS.MESSAGE_POST, ({ message, user, recv }) => {
                log.push(`from: ${user.id} to: ${recv} - ${message.content}`);
            });

            expect(() => c.postMessage('u1', 'msg1')).not.toThrow();
            expect(log).toEqual(['from: u1 to: u1 - msg1', 'from: u1 to: u2 - msg1']);
            u2.revoke(POWERS.READ);
            expect(() => c.postMessage('u1', 'msg2')).not.toThrow();
            expect(log).toEqual([
                'from: u1 to: u1 - msg1',
                'from: u1 to: u2 - msg1',
                'from: u1 to: u1 - msg2',
            ]);
        });
    });
    describe('linkUser/unlkinkUSer', () => {
        it('should add/remove users', () => {
            const c = new Txat.Channel('c1');
            expect(c.users.length).toBe(0);
            c.addUser('u1');
            expect(c.users.length).toBe(1);
            expect(c.users[0]).toMatchObject({
                id: 'u1',
            });
            c.addUser('u2');
            expect(c.users.length).toBe(2);
            expect(c.users[1]).toMatchObject({
                id: 'u2',
            });
            c.removeUser('u1');
            expect(c.users.length).toBe(1);
            expect(c.users[0]).toMatchObject({
                id: 'u2',
            });
        });
    });
    describe('Private channels', () => {
        it('should return true only when whitelist is modified', () => {
            const c = new Txat.Channel('c1');
            expect(c.private).toBe(false);
            c.allow('u1');
            expect(c.private).toBe(true);
        });
        it('should not be able to enter channel if blacklisted', () => {
            const c = new Txat.Channel('c1');
            c.ban('u1');
            expect(() => c.addUser('u1')).toThrow();
            expect(c.users.length).toBe(0);
            expect(() => c.addUser('u2')).not.toThrow();
            expect(c.users.length).toBe(1);
        });
    });
});
