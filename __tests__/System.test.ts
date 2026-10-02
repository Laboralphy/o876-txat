import * as Txat from '../src';

describe('register user', () => {
    it('should register u1 when calling function', () => {
        const s = new Txat.System();
        const u1 = s.registerUser('u1');
        expect(u1.id).toBe('u1');
        expect(u1.joinedChannels.size).toBe(0);
    });
});

describe('userJoinChannel', () => {
    it('should throw when inexistent user try to join inexistent channel', () => {
        const s = new Txat.System();
        expect(() => s.userJoinChannel('u1', 'c1')).toThrow();
    });
    it('should throw when inexistent user try to join channel', () => {
        const s = new Txat.System();
        const c1 = s.addChannel('c1');
        expect(() => s.userJoinChannel('u1', 'c1')).toThrow();
    });
    it('should throw when user try to join inexistent channel', () => {
        const s = new Txat.System();
        const u1 = s.registerUser('u1');
        expect(() => s.userJoinChannel('u1', 'c1')).toThrow();
    });
    it('should not throw when user try to join channel', () => {
        const s = new Txat.System();
        const u1 = s.registerUser('u1');
        const c1 = s.addChannel('c1');
        expect(() => s.userJoinChannel('u1', 'c1')).not.toThrow();
        expect(u1.joinedChannels.size).toBe(1);
        expect(c1.users.length).toBe(1);
    });
});

describe('unregister user', () => {
    it('should remove u1 from c1 user list when unregistering u1 from system', () => {
        const s = new Txat.System();
        const u1 = s.registerUser('u1');
        const c1 = s.addChannel('c1');
        s.userJoinChannel('u1', 'c1');
        expect(u1.joinedChannels.size).toBe(1);
        expect(c1.users.length).toBe(1);
        expect(s.getChannelList().length).toBe(1);
        s.unregisterUser('u1');
        expect(c1.users.length).toBe(0);
    });
});
