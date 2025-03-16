const StdDateProvider = require('../src/date-provider/StdDateProvider');
const IDateProvider = require('../src/date-provider/IDateProvider');
const EVENT_TYPES = require('../src/data/event-types.json');
const TxatManager = require('../src/TxatManager');
const User = require('../src/User');
const Channel = require('../src/Channel');
const USER_RANKS = require('../src/data/user-ranks.json');

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
        expect(() => tm.getUser('aaa')).not.toThrow('user aaa does not exist');
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
        expect(() => tm.userLeavesChannel(u2, tm.getChannel('lobby'))).toThrow(`can't remove user ${u2.id} from channel : not connected to this channel`);
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

describe('userSendsChannelMessage', () => {
    it ('should send public message to all channel users', () => {
        const tm = new TxatManager();
        const logMessages = [];
        tm.events.on(EVENT_TYPES.EVENT_CHANNEL_MESSAGE, ({ recipient, channel, message }) => {
            logMessages.push({
                user: recipient,
                channel: channel.id,
                messageSender: message.sender.id,
                messageContent: message.content
            });
        });
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        const u3 = tm.connectUser('u3');
        const u4 = tm.connectUser('u4');
        tm.userJoinsChannel(u1, 'lobby');
        tm.userJoinsChannel(u2, 'lobby');
        tm.userJoinsChannel(u3, 'lobby');
        const lobby = tm.getChannel('lobby');

        tm.userSendsChannelMessage(u2, lobby, 'hello!');
        expect(logMessages.length).toBe(3);

        expect(logMessages[0].messageSender).toBe('u2');
        expect(logMessages[1].messageSender).toBe('u2');
        expect(logMessages[2].messageSender).toBe('u2');

        expect(logMessages[0].channel).toBe('lobby');
        expect(logMessages[1].channel).toBe('lobby');
        expect(logMessages[2].channel).toBe('lobby');

        expect(logMessages[0].messageContent).toBe('hello!');
        expect(logMessages[1].messageContent).toBe('hello!');
        expect(logMessages[2].messageContent).toBe('hello!');

        const recipients = new Set();
        logMessages.forEach(m => recipients.add(m.user));

        expect(recipients.has('u1')).toBeTruthy();
        expect(recipients.has('u2')).toBeTruthy();
        expect(recipients.has('u3')).toBeTruthy();

        tm.userLeavesChannel(u2, lobby);

        logMessages.splice(0, 3);
        expect(logMessages.length).toBe(0);

        tm.userSendsChannelMessage(u1, lobby, 'agur!');

        expect(logMessages.length).toBe(2);

        expect(logMessages[0].messageSender).toBe('u1');
        expect(logMessages[1].messageSender).toBe('u1');

        expect(logMessages[0].channel).toBe('lobby');
        expect(logMessages[1].channel).toBe('lobby');

        expect(logMessages[0].messageContent).toBe('agur!');
        expect(logMessages[1].messageContent).toBe('agur!');

        const recipients2 = new Set();
        logMessages.forEach(m => recipients2.add(m.user));

        expect(recipients2.has('u1')).toBeTruthy();
        expect(recipients2.has('u3')).toBeTruthy();


        logMessages.splice(0, logMessages.length);
        expect(logMessages.length).toBe(0);

        tm.userJoinsChannel(u4, 'lobby');

        tm.userSendsChannelMessage(u4, lobby, 'hi!');

        expect(logMessages.length).toBe(3);

        expect(logMessages[0].messageSender).toBe('u4');
        expect(logMessages[1].messageSender).toBe('u4');
        expect(logMessages[2].messageSender).toBe('u4');

        expect(logMessages[0].channel).toBe('lobby');
        expect(logMessages[1].channel).toBe('lobby');
        expect(logMessages[2].channel).toBe('lobby');

        expect(logMessages[0].messageContent).toBe('hi!');
        expect(logMessages[1].messageContent).toBe('hi!');
        expect(logMessages[2].messageContent).toBe('hi!');

        const recipients3 = new Set();
        logMessages.forEach(m => recipients3.add(m.user));

        expect(recipients3.has('u1')).toBeTruthy();
        expect(recipients3.has('u3')).toBeTruthy();
        expect(recipients3.has('u4')).toBeTruthy();
    });
    it ('should not send public message when not connected to channel', () => {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        const u3 = tm.connectUser('u3');
        tm.userJoinsChannel(u1, 'lobby');
        tm.userJoinsChannel(u2, 'lobby');
        const lobby = tm.getChannel('lobby');
        expect(tm.userSendsChannelMessage(u2, lobby, 'agur!')).toBeTruthy();
        expect(tm.userSendsChannelMessage(u1, lobby, 'xxx!')).toBeTruthy();
        expect(() => tm.userSendsChannelMessage(u3, lobby, 'vvv')).toThrow('user u3 does not exist in this channel');
    });
});

describe('userSendsPrivateMessage', () => {
    it('should produce event when sending private message', () => {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        const logPM = [];
        tm.events.on(EVENT_TYPES.EVENT_USER_RECEIVE_PRIVATE_MESSAGE, ({ recipient, message }) => {
            logPM.push({
                from: message.sender.id,
                content: message.content,
                to: recipient
            });
        });
        tm.userSendsPrivateMessage(u1, u2, 'hello');
        expect(logPM.length).toBe(1);
        expect(logPM[0]).toEqual({
            from: 'u1',
            to: 'u2',
            content: 'hello'
        });
    });
});

describe('setUserRank', () => {
    it('should throw an error when trying to raise own rank', function () {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        tm.userJoinsChannel(u1, 'lobby');
        tm.userJoinsChannel(u2, 'lobby');
        const lobby = tm.getChannel('lobby');
        expect(() => tm.setUserRank(u1, lobby, u1, USER_RANKS.USER_RANK_ADMIN))
            .toThrow('user rank is greater or equal than promoter rank ; user USER_RANK_HOST - promoter USER_RANK_HOST');
        expect(() => tm.setUserRank(u2, lobby, u2, USER_RANKS.USER_RANK_ADMIN))
            .toThrow('user u2 can\'t perform this operation on channel lobby ; insufficient capabilities ; need CAPABILITY_PROMOTE');
    });
    it('should throw an error when trying to raise user rank above own rank', function () {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        const u3 = tm.connectUser('u3');
        tm.userJoinsChannel(u1, 'lobby');
        tm.userJoinsChannel(u2, 'lobby');
        tm.userJoinsChannel(u3, 'lobby');
        const lobby = tm.getChannel('lobby');
        expect(() => tm.setUserRank(u1, lobby, u1, USER_RANKS.USER_RANK_ADMIN))
            .toThrow('user rank is greater or equal than promoter rank ; user USER_RANK_HOST - promoter USER_RANK_HOST');
        lobby.setUserRank(u2, USER_RANKS.USER_RANK_ADMIN);
        expect(lobby.getUserRank(u2).id).toBe(USER_RANKS.USER_RANK_ADMIN);
        expect(() => tm.setUserRank(u2, lobby, u3, USER_RANKS.USER_RANK_HOST))
            .toThrow('new rank would be higher than promoter rank ; promoter USER_RANK_ADMIN - target rank USER_RANK_HOST');
    });
});

describe('ignoreUser / unignore', () => {
    it('should not send public message to u1 when u2 speaking and u1 ignoring u2', () => {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        const lobby = tm.createChannel('lobby');
        lobby.permanent = true;
        lobby.public = true;

        const aLogMessages = [];

        tm.events.on(EVENT_TYPES.EVENT_CHANNEL_MESSAGE, ({ message, recipient }) => {
            aLogMessages.push(recipient);
        });

        tm.userJoinsChannel(u1, lobby);
        tm.userJoinsChannel(u2, lobby);

        expect(lobby.users.size).toBe(2);

        tm.userSendsChannelMessage(u2, lobby, 'u1 is stupid');

        expect(aLogMessages.includes('u1')).toBeTruthy();
        expect(aLogMessages.includes('u2')).toBeTruthy();

        tm.ignoreUser(u1, u2);
        aLogMessages.splice(0, aLogMessages.length);

        tm.userSendsChannelMessage(u2, lobby, 'u1 is a complete moron');

        expect(aLogMessages.includes('u1')).toBeFalsy();
        expect(aLogMessages.includes('u2')).toBeTruthy();

        tm.unignoreUser(u1, u2);
        aLogMessages.splice(0, aLogMessages.length);

        tm.userSendsChannelMessage(u2, lobby, 'u1 is still a complete moron');

        expect(aLogMessages.includes('u1')).toBeTruthy();
        expect(aLogMessages.includes('u2')).toBeTruthy();
    });

    it('should not receive private message from u2 when ignoring u2', () => {
        const tm = new TxatManager();
        const u1 = tm.connectUser('u1');
        const u2 = tm.connectUser('u2');
        const lobby = tm.createChannel('lobby');
        lobby.permanent = true;
        lobby.public = true;

        const aLogMessages = [];

        tm.events.on(EVENT_TYPES.EVENT_USER_RECEIVE_PRIVATE_MESSAGE, ({ message }) => {
            aLogMessages.push(message.sender.id + ': ' + message.content);
        });

        tm.userJoinsChannel(u1, lobby);
        tm.userJoinsChannel(u2, lobby);

        tm.userSendsPrivateMessage(u2, u1, 'tu es un fdp');

        expect(aLogMessages.length).toBe(1);
        expect(aLogMessages[0]).toBe('u2: tu es un fdp');

        tm.ignoreUser(u1, u2);

        tm.userSendsPrivateMessage(u2, u1, 'tu es un GROS fdp');

        expect(aLogMessages.length).toBe(1);
        expect(aLogMessages[0]).toBe('u2: tu es un fdp');

        tm.unignoreUser(u1, u2);

        tm.userSendsPrivateMessage(u2, u1, 'tu es un GIGA fdp');

        expect(aLogMessages.length).toBe(2);
        expect(aLogMessages[1]).toBe('u2: tu es un GIGA fdp');
    });
});

describe('team discussion', function () {

});
