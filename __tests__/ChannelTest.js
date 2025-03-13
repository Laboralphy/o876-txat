const Channel = require('../src/Channel');
const StdDateProvider = require('../src/date-provider/StdDateProvider');
const IDateProvider = require('../src/date-provider/IDateProvider');
const EVENT_TYPES = require('../src/data/event-types.json');

describe('addUser', function () {
    it('should have 1 user after creating channel and adding one user', function () {
        const c = new Channel('c1');
        expect(c.users.size).toBe(0);
        c.addUser({ id: 'u1' });
        expect(c.users.size).toBe(1);
    });
    it('should not be able to add same user twice', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        expect(() => c.addUser(u1)).not.toThrow();
        expect(() => c.addUser(u1)).toThrow();
    });
    it('should return user rank chatter when adding a new user', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        c.addUser(u1);
        expect(c.getUserRank(u1).id).toBe('USER_RANK_CHATTER');
    });
});

describe('removeUser', function () {
    it('should remove user when user is previously added', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        c.addUser({ id: 'u1' });
        c.removeUser(u1);
        expect(c.users.size).toBe(0);
    });
    it('should remove user when user is not in channel', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        expect(() => c.removeUser(u1)).toThrow();
    });
});

describe('getUserRank/setUserRank', function () {
    it('should be a chatter by default', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        c.addUser(u1);
        expect(c.getUserRank(u1).id).toBe('USER_RANK_CHATTER');
        expect(c.getUserRank(u1).capabilities.has('CAPABILITY_SAY'));
        expect(c.getUserRank(u1).capabilities.has('CAPABILITY_VIEW'));
    });
    it('should be a chatter by default', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        c.addUser(u1);
        c.setUserRank(u1, 'USER_RANK_HOST');
        expect(c.getUserRank(u1).id).toBe('USER_RANK_HOST');
        expect(c.getUserRank(u1).capabilities.has('CAPABILITY_SAY'));
        expect(c.getUserRank(u1).capabilities.has('CAPABILITY_VIEW'));
        expect(c.getUserRank(u1).capabilities.has('CAPABILITY_PROMOTE'));
    });
});

describe('banUser', function () {
    it('should ban user', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        c.addUser(u1);
        const DateTest = class extends IDateProvider {
            now () {
                return new Date(2020, 0, 1, 0, 0, 0);
            }
            add (date, addTime) {
                return new Date(2020, 0, 1, 0, 5, 0);
            }
        };
        c.inject({ dateProvider: new DateTest()});
        expect(c.users.size).toBe(1);
        const b0 = c.banUser(u1, 'bother me', { duration: '5 minutes' });
        expect(c.users.size).toBe(0);
        expect(c.bans.size).toBe(1);
        const b1 = c.bans.get(u1.id);
        expect(b0).toBe(b1);
        expect(b1.until).not.toBeNull();
        expect(b1.reason).toBe('bother me');
        expect(b1.until.getFullYear()).toBe(2020);
        expect(b1.until.getMonth()).toBe(0);
        expect(b1.until.getDate()).toBe(1);
        expect(b1.until.getFullYear()).toBe(2020);
        expect(b1.until.getHours()).toBe(0);
        expect(b1.until.getMinutes()).toBe(5);
    });

    it('should not be able to rejoin channel when user is banned', function () {
        const c = new Channel('c1');
        const u1 = { id: 'u1' };
        const stdDate = new StdDateProvider();
        const DateTest = class extends IDateProvider {
            constructor () {
                super();
                this.dateNow = new Date(2020, 0, 1, 0, 0, 0);
            }

            now () {
                return new Date(this.dateNow.getTime());
            }
            add (date, addTime) {
                return stdDate.add(date, addTime);
            }
            parse (sDate) {
                return stdDate.parse(sDate);
            }
        };
        const dt = new DateTest();

        c.inject({ dateProvider: dt });


        const aBanLog = [];

        c.events.on(EVENT_TYPES.EVENT_USER_BANNED, payload => aBanLog.push({
            user: payload.user.id,
            reason: payload.ban.reason
        }));

        expect(c.addUser(u1)).toBeTruthy();
        const b0 = c.banUser(u1, 'bother me', { duration: '5 minutes' });
        expect(c.addUser(u1)).toBeFalsy();

        expect(aBanLog.pop()).toEqual({
            user: 'u1',
            reason: 'bother me'
        });

        dt.dateNow = new Date('2020-01-01 00:30:00');

        expect(b0.active).toBeFalsy();

        expect(c.addUser(u1)).toBeTruthy();
    });
});
