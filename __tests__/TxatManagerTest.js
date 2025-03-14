const StdDateProvider = require('../src/date-provider/StdDateProvider');
const IDateProvider = require('../src/date-provider/IDateProvider');
const EVENT_TYPES = require('../src/data/event-types.json');
const TxatManager = require('../src/TxatManager');
const User = require('../src/User');
const Channel = require('../src/Channel');

class MockDate extends IDateProvider {
    constructor () {
        super();
        this.stdDate = new StdDateProvider();
        this.dateNow = new Date(2020, 0, 1, 0, 0, 0);
    }

    now () {
        return new Date(this.dateNow.getTime());
    }

    add (date, addTime) {
        return this.stdDate.add(date, addTime);
    }

    parse (sDate) {
        return this.stdDate.parse(sDate);
    }
}




describe('channelExists', () => {
    it('should return false when asking for a non existant channel', () => {
        const tm = new TxatManager();
        expect(tm.channelExists('wtf')).toBeFalsy();
    });

    it('should return true when asking for an existant channel', () => {
        const tm = new TxatManager();
        tm.createChannel('xyz');
        expect(tm.channelExists('xyz')).toBeTruthy();
    });
});

describe('userExists', () => {
    it('should return true when asking for an non-existant user', () => {
        const tm = new TxatManager();
        expect(tm.userExists('xyz')).toBeFalsy();
    });
    it('should return true when asking for an existant user', () => {
        const tm = new TxatManager();
        tm.connectUser('zerty');
        expect(tm.userExists('zerty')).toBeTruthy();
    });
    it('should return false when asking for an existant user who has just disconnected', () => {
        const tm = new TxatManager();
        const u = tm.connectUser('zerty');
        expect(tm.userExists('zerty')).toBeTruthy();
        tm.disconnectUser(u);
        expect(tm.userExists('zerty')).toBeFalsy();
    });
});

describe('channelList', () => {
    it('should return [abc, def] when creating two channels abc & def', function () {
        const tm = new TxatManager();
        tm.createChannel('abc');
        tm.createChannel('def');
        expect(tm.getChannelList().map(c => c.id)).toEqual(['abc', 'def']);
    });
    it('should return [abc] when creating two channels abc & def, and destroying abc', function () {
        const tm = new TxatManager();
        tm.createChannel('def');
        tm.createChannel('abc');
        tm.destroyChannel('def');
        expect(tm.getChannelList().map(c => c.id)).toEqual(['abc']);
    });
});

describe('createUser', () => {
    it('should create user instance when calling method', function () {
        const tm = new TxatManager();
        const u = tm.createUser('aaa');
        expect(u).toBeInstanceOf(User);
    });
    it('should *NOT* add created user to user list', function () {
        const tm = new TxatManager();
        const u = tm.createUser('aaa');
        expect(tm.userExists('aaa')).toBeFalsy();
    });
});

describe('getChannel', () => {
    it('should return newly created channel', function () {
        const tm = new TxatManager();
        const c = tm.createChannel('abc');
        const d2 = tm.getChannel('abc');
        expect(c).toBeInstanceOf(Channel);
        expect(d2).toBeInstanceOf(Channel);
        expect(c).toBe(d2);
    });
});

describe('getUser', () => {
    it('should not return newly created user prior to connecting', () => {
        const tm = new TxatManager();
        const u = tm.createUser('aaa');
        expect(() => tm.getUser('aaa')).toThrow('user aaa does not exist');
    });

    it('should return newly created user after connecting', () => {
        const tm = new TxatManager();
        expect(() => tm.getUser('aaa')).toThrow('user aaa does not exist');
        const u = tm.connectUser('aaa');
        expect(() => tm.getUser('aaa')).not.toThrow('user aaa does not exist');
        expect(tm.getUser('aaa')).toBe(u);
    });
});

describe('connectUser', () => {
    it('should re use previous connected instance of user', () => {
        const tm = new TxatManager();
        expect(() => tm.getUser('aaa')).toThrow('user aaa does not exist');
        const u = tm.connectUser('aaa');
        expect(tm.getUser('aaa')).toBe(u);
        tm.disconnectUser(u);
        expect(() => tm.getUser('aaa')).toThrow('user aaa does not exist');
        expect(u.connected).toBe(false);
        const u2 = tm.connectUser('aaa');
        expect(tm.getUser('aaa')).toBe(u);
        expect(tm.getUser('aaa')).toBe(u2);
        expect(u.connected).toBe(true);
    });
});

describe('userJoinsChannel', () => {
    it('should make a user join a new channel', function () {
        const tm = new TxatManager();
        const aEvents = [];
        tm.events.on(EVENT_TYPES.EVENT_USER_CONNECTED, ({ user }) => {
            aEvents.push({ type: EVENT_TYPES.EVENT_USER_CONNECTED, user });
        });
        tm.events.on(EVENT_TYPES.EVENT_USER_JOINED_CHANNEL, ({ user, channel }) => {
            aEvents.push({ type: EVENT_TYPES.EVENT_USER_JOINED_CHANNEL, user });
        });
        const u = tm.connectUser('u1');
        tm.userJoinsChannel(u, 'lobby');
        expect(aEvents).toHaveLength(2);
        expect(aEvents[1].type).toBe(EVENT_TYPES.EVENT_USER_JOINED_CHANNEL);
        expect(aEvents[1].user.id).toBe('u1');
    });

    it('should fire event when new user join existing channel', function () {
        const tm = new TxatManager();
        const aEvents = [];
        tm.events.on(EVENT_TYPES.EVENT_USER_JOINED_CHANNEL, ({ recipient, user, channel }) => {
            aEvents.push({ type: EVENT_TYPES.EVENT_USER_JOINED_CHANNEL, recipient, user, channel });
        });
        const u1 = tm.createUser('u1');
        const u2 = tm.createUser('u2');
        expect(aEvents).toHaveLength(0);
        tm.userJoinsChannel(u1, 'lobby');
        expect(aEvents).toHaveLength(1);
        expect(aEvents[0].user.id).toBe('u1');
        expect(aEvents[0].recipient).toBe('u1');

        tm.userJoinsChannel(u2, 'lobby');
        expect(aEvents).toHaveLength(3);
        expect(aEvents[1].user.id).toBe('u2');
        expect(aEvents[1].recipient).toBe('u1');
        expect(aEvents[2].user.id).toBe('u2');
        expect(aEvents[2].recipient).toBe('u2');
    });
});

describe('userLeavesChannel', () => {
    it('should throw an error when leaving a channel you are not in', () => {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        tm.userJoinsChannel(u1, 'lobby');
        expect(() => tm.userLeavesChannel(u2, tm.getChannel('lobby'))).toThrow(`Can't remove user ${u2.id} from channel : not connected to this channel`);
    });
    it('should destroy channel lobby when all users leave', () => {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        tm.userJoinsChannel(u1, 'lobby');
        tm.userJoinsChannel(u2, 'lobby');
        expect(tm.channelExists('lobby')).toBe(true);
        const c = tm.getChannel('lobby');
        tm.userLeavesChannel(u1, c);
        expect(tm.channelExists('lobby')).toBe(true);
        tm.userLeavesChannel(u2, c);
        expect(tm.channelExists('lobby')).toBe(false);
    });
});
