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
        if (typeof id !== 'string') {
            throw new TypeError('channel identifier requires to be string');
        }
        this._id = id;
        this._name = id;
        this._topic = '';
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
            throw new TypeError('invalid date provider');
        }
    }

    /**
     * If true, anybony can join this channel, else the channel is available only for invitation for rergular user
     * (host, admin and moderator) can still join
     * @returns {boolean}
     */
    get public () {
        return this._public;
    }

    /**
     * Set new value for public channel flag
     * @param value {boolean}
     */
    set public (value) {
        this._public = value;
    }

    /**
     * Returns the channel topic
     * @returns {string}
     */
    get topic () {
        return this._topic;
    }

    /**
     * change the channel topic
     * @param value {string}
     */
    set topic (value) {
        this._topic = value;
    }

    /**
     * @returns {Map<string, User>}
     */
    get users () {
        return this._users;
    }

    /**
     * Return channel identifier
     * @returns {string}
     */
    get id () {
        return this._id;
    }

    /**
     * Return all bans
     * @returns {Map<string, Ban>}
     */
    get bans () {
        return this._bans;
    }

    /**
     * Returns the event emitter instance
     * @returns {module:events.EventEmitter<DefaultEventMap>}
     */
    get events () {
        return this._events;
    }

    /**
     * set the channel permanent flag
     * @param value {boolean}
     */
    set permanent (value) {
        this._permanent = value;
    }

    /**
     * If true then the channel does not disappear when all users leave
     * @returns {boolean}
     */
    get permanent () {
        return this._permanent;
    }

    /**
     * returns channel name
     * @returns {string}
     */
    get name () {
        return this._name;
    }

    /**
     * set channel name
     * @param value {string}
     */
    set name (value) {
        this._name = value;
    }

    /**
     * post a new message on this channel
     * @param user {User}
     * @param sText {string}
     */
    postMessage (user, sText) {
        if (this.hasUserCapabilities(user, CAPABILITIES.CAPABILITY_SAY)) {
            const message = new Message(sText, user, this._dateProvider.now().getTime());
            while (this._messages.length >= this._maxMessageCount) {
                this._messages.shift();
            }
            this._messages.push(message);
            this._events.emit(EVENT_TYPES.EVENT_CHANNEL_MESSAGE, {
                message
            });
            return true;
        } else {
            this._events.emit(EVENT_TYPES.EVENT_USER_INSUFFICIENT_CAPABILITY, {
                user: user,
                capability: CAPABILITIES.CAPABILITY_SAY
            });
            return false;
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
     * @returns {{index: number, id: string, capabilities: Set<string>}}
     */
    getUserRank (user) {
        const ur = this._userRanks.get(user.id);
        if (!ur) {
            throw new Error(`user ${user.id} does not exist in this channel`);
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
            throw new TypeError(`rank ${rank} does not exist`);
        }
    }

    /**
     * Returns true if user is banned
     * @param user {User}
     * @returns {boolean}
     */
    isUserBanned (user) {
        const ban = this._bans.get(user.id);
        if (ban) {
            if (ban.active) {
                return true;
            } else {
                this._bans.delete(user.id);
            }
        }
        return false;
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
        if (this.isUserBanned(user)) {
            return false;
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
            throw new Error(`can't remove user ${user.id} from channel : not connected to this channel`);
        }
        this._userRanks.delete(user.id);
        this._users.delete(user.id);
        this._events.emit(EVENT_TYPES.EVENT_USER_LEFT_CHANNEL, {
            user
        });
    }

    /**
     * Remove channel permanent flag, and Kicks all user out of the channel
     * making the channel disappear
     */
    close () {
        this._permanent = false;
        for (const [, user] of this.users) {
            this.removeUser(user);
        }
    }

    /**
     * Prevent a user from returning ti this channel
     * @param user {User}
     * @param reason {string} reason why this user is banned
     * @param duration {string} duration format ex: "5 mins", "1 hour", "7 days"
     * @param date {string} YYYY-MM-DD [HH:MM:[SS]] format
     * @param permanent {boolean} if true then ban has infinite duration
     * @returns {Ban}
     */
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
            throw new Error('should specify "until", "permanent" or "date" for ban');
        }
        this._bans.set(user.id, ban);
        this._events.emit(EVENT_TYPES.EVENT_USER_BANNED, {
            user,
            ban
        });
        this.removeUser(user);
        return ban;
    }

    /**
     * Remove user Ban
     * @param user {User}
     */
    unbanUser (user) {
        if (this.isUserBanned(user)) {
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
