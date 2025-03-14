const CAPABILITIES = require('./data/capabilities.json');
const Ban = require('./Ban');
const Events = require('node:events');
const EVENT_TYPES = require('./data/event-types.json');
const userRanks = require('./user-ranks');
const USER_RANKS = require('./data/user-ranks.json');
const Message = require('./Message');
const User = require('./User');
const IDateProvider = require('./date-provider/IDateProvider');

class Channel {
    constructor (id) {
        this._id = id;
        this._name = id;
        this._messages = [];
        this._maxMessageCount = 100;
        /**
         * @type {Map<string, User>}
         * @private
         */
        this._users = new Map();
        this._userRanks = new Map();
        /**
         * @type {Map<string, Ban>}
         * @private
         */
        this._bans = new Map();
        this._events = new Events();
        this._defaultUserRank = USER_RANKS.USER_RANK_CHATTER;
        this._dateProvider = null;
        this._permanent = false;
        this._public = true;
    }

    inject ({ dateProvider }) {
        if (dateProvider instanceof IDateProvider) {
            this._dateProvider = dateProvider;
        } else {
            throw new TypeError('Invalid date provider');
        }
    }

    get public () {
        return this._public;
    }

    set public (value) {
        this._public = value;
    }

    /**
     * @returns {Map<string, User>}
     */
    get users () {
        return this._users;
    }

    get id () {
        return this._id;
    }

    set id (value) {
        this._id = value;
    }

    get bans () {
        return this._bans;
    }

    get events () {
        return this._events;
    }

    set permanent (value) {
        this._permanent = value;
    }

    get permanent () {
        return this._permanent;
    }

    get state () {
        const userRanks = [];
        for (const [idUser, rank] of this._userRanks) {
            userRanks.push({
                user: idUser,
                rank: rank.id
            });
        }
        const banList = [];
        for (const [, ban] of this._bans) {
            banList.push(ban.state);
        }
        return {
            id: this.id,
            name: this._name,
            permanent: this.permanent,
            userRanks,
            banList,
            defaultUserRank: this._defaultUserRank
        };
    }

    postMessage (user, sText) {
        if (this.hasUserCapabilities(user, CAPABILITIES.CAPABILITY_SAY)) {
            const message = new Message(sText, user);
            while (this._messages.length >= this._maxMessageCount) {
                this._messages.shift();
            }
            this._messages.push(message);
            this._events.emit(EVENT_TYPES.EVENT_CHANNEL_MESSAGE, {
                message
            });
        } else {
            this._events.emit(EVENT_TYPES.EVENT_USER_INSUFFICIENT_CAPABILITY, {
                user: user,
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
        if (ban) {
            if (ban.active) {
                this._events.emit(EVENT_TYPES.EVENT_USER_BANNED, {
                    user,
                    ban
                });
                return false;
            } else {
                this._bans.delete(user.id);
            }
        }
        this._users.set(user.id, user);
        this._events.emit(EVENT_TYPES.EVENT_USER_JOINED_CHANNEL, {
            user
        });
        return true;
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
            user
        });
    }

    close () {
        this._permanent = false;
        for (const [, user] of this.users) {
            this.removeUser(user);
        }
    }

    banUser (user, reason, { duration = '', date = '', permanent = false }) {
        const ban = new Ban(user, reason);
        ban.inject({ dateProvider: this._dateProvider });
        if (permanent) {
            ban.permanent = true;
        } else if (duration) {
            const dFrom = this._dateProvider.now();
            ban.setDurationString(duration, dFrom);
        } else if (date) {
            ban.setUnbanDate(date);
        } else {
            throw new Error('should specify "until", or "date" for ban');
        }
        this._bans.set(user.id, ban);
        this._events.emit(EVENT_TYPES.EVENT_USER_BANNED, {
            user,
            ban
        });
        this.removeUser(user);
        return ban;
    }

    unbanUser (user) {
        const ban = this._bans.get(user.id);
        if (ban) {
            this._bans.delete(user.id);
            this._events.emit(EVENT_TYPES.EVENT_USER_UNBANNED, {
                user
            });
        } else {
            throw new Error(`user ${user.id} is not banned from ${this.id}`);
        }
    }
}

module.exports = Channel;
