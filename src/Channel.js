const CAPABILITIES = require('./data/capabilities.json');
const Banishment = require('./Banishment');
const Events = require('node:events');
const EVENT_TYPES = require('./data/event-types.json');
const userRanks = require('./user-ranks');
const USER_RANKS = require('./data/user-ranks.json');
const Message = require('./Message');
const User = require('./User');

class Channel {
    constructor (id) {
        this._id = id;
        this._name = '#' + id;
        this._messages = [];
        this._maxMessageCount = 256;
        this._users = new Map();
        this._userRanks = new Map();
        this._bans = new Map();
        this._events = new Events();
        this._defaultUserRank = USER_RANKS.USER_RANK_CHATTER;
        this._dateProvider = null;
    }

    /**
     * @param dateProvider {IDateProvider}
     */
    set dateProvider (dateProvider) {
        this._dateProvider = dateProvider;
    }

    /**
     * @returns {IDateProvider}
     */
    get dateProvider () {
        if (!this._dateProvider) {
            throw new Error('Date provider not injected');
        }
        return this._dateProvider;
    }

    get users () {
        return this._users;
    }

    get id () {
        return this._id;
    }

    get bans () {
        return this._bans;
    }

    postMessage (user, sText) {
        if (this.hasUserCapabilities(user, CAPABILITIES.CAPABILITY_SAY)) {
            const message = new Message(sText, user);
            while (this._messages.length >= this._maxMessageCount) {
                this._messages.shift();
            }
            this._messages.push(message);
            this._events.emit(EVENT_TYPES.EVENT_CHANNEL_MESSAGE, {
                message,
                channel: this
            });
        } else {
            this._events.emit(EVENT_TYPES.EVENT_USER_INSUFFICIENT_CAPABILITY, {
                user: user,
                channel: this,
                capability: CAPABILITIES.CAPABILITY_SAY
            });
        }
    }

    /**
     * returns true if user has the specified capability
     * @param user {User}
     * @param capability {string}
     * @returns {boolean}
     */
    hasUserCapabilities (user, capability) {
        return this.getUserRank(user).capabilities.has(capability);
    }

    /**
     * Get user rank objet
     * @param user {User}
     * @returns {{rank: number, id: string, capabilities: Set<string>}}
     */
    getUserRank (user) {
        const ur = this._userRanks.get(user.id);
        if (!ur) {
            throw new Error(`this user ${user.id} does not exist in this channel`);
        }
        return userRanks[ur];
    }

    /**
     * Change user rank
     * @param user {User}
     * @param rank {string} USER_RANK_*
     */
    setUserRank (user, rank) {
        if (rank in USER_RANKS) {
            this._userRanks.set(user.id, rank);
        } else {
            throw new TypeError('this rank does not exist ' + rank);
        }
    }

    /**
     * Adds a new user to this channel
     * If user already exists : throw an error
     * @param user {User} new channel user
     */
    addUser (user) {
        if (this._users.has(user.id)) {
            throw new Error(`user ${user.id} is already connected to this channel`);
        }
        if (!this._userRanks.has(user.id)) {
            this.setUserRank(user, this._defaultUserRank);
        }
        const ban = this._bans.get(user.id);
        if (ban && ban.isActive) {
            this._events.emit(EVENT_TYPES.EVENT_USER_BANISHED, {
                user,
                channel: this,
                ban
            });
            return false;
        }
        this._users.set(user.id, user);
        this._events.emit(EVENT_TYPES.EVENT_USER_JOINED_CHANNEL, {
            channel: this,
            user
        });
    }

    /**
     * Removes an user from this channel
     * @param user {User}
     */
    removeUser (user) {
        if (!this._users.has(user.id)) {
            throw new Error(`Can't remove user ${user.id} from channel : not connected to this channel`);
        }
        this._userRanks.delete(user.id);
        this._users.delete(user.id);
        this._events.emit(EVENT_TYPES.EVENT_USER_LEFT_CHANNEL, {
            channel: this,
            user
        });
    }

    banUser (user, reason, { duration = '', date = '' }) {
        const ban = new Banishment(user, reason);
        if (duration) {
            ban.setDurationString(duration, this.dateProvider.now());
        } else if (date) {
            ban.setUnbanDate(date);
        } else {
            throw new Error('should specify "until", or "date" for banishment');
        }
        this._bans.set(user.id, ban);
        this._events.emit(EVENT_TYPES.EVENT_USER_BANISHED, {
            user,
            channel: this,
            ban
        });
        this.removeUser(user);
        return ban;
    }

    unbanUser (user) {
        const ban = this._bans.get(user.id);
        if (ban) {
            this._bans.delete(user.id);
            this._events.emit(EVENT_TYPES.EVENT_USER_UNBANISHED, {
                user,
                channel: this
            });
        } else {
            throw new Error(`user ${user.id} is not banished from ${this.id}`);
        }
    }
}

module.exports = Channel;
