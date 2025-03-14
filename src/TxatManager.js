const Channel = require('./Channel');
const User = require('./User');
const USER_RANKS = require('./data/user-ranks.json');
const Events = require('events');
const StdDateProvider = require('./date-provider/StdDateProvider');
const EVENT_TYPES = require('./data/event-types.json');
const CAPABILITIES = require('./data/capabilities.json');
const Message = require('./Message');

class TxatManager {
    constructor () {
        /**
         * @type {Map<string, Channel>}
         * @private
         */
        this._channels = new Map();
        /**
         * @type {Map<string, User>}
         * @private
         */
        this._users = new Map();
        /**
         * @type {Map<string, User>}
         * @private
         */
        this._disconnectedUser = new Map();
        this._events = new Events();
        /**
         * @type {IDateProvider}
         * @private
         */
        this._dateProvider = new StdDateProvider();
    }

    get events () {
        return this._events;
    }

    /**
     * Returns true if channel exists
     * @param idChannel {string}
     * @returns {boolean}
     */
    channelExists (idChannel) {
        return this._channels.has(idChannel);
    }

    /**
     * Returns true if user exists and is connected
     * @param idUser {string}
     * @returns {boolean}
     */
    userExists (idUser) {
        return this._users.has(idUser);
    }

    /**
     * return a list of currently create channels
     * @returns {Channel[]}
     */
    getChannelList () {
        return [...this._channels.values()];
    }

    /**
     * re emit incoming event from a specified channel to this event emitter, with a reference of original channel
     * @param aEvents {string[]}
     * @param channel {Channel}
     * @private
     */
    _reemitChannelEvent (aEvents, channel) {
        for (const sEvent of aEvents) {
            channel.events.on(sEvent, (payload) => {
                this._events.emit(sEvent, {
                    ...payload,
                    channel
                });
            });
        }
    }
    /**
     * re emit incoming event from a specified user to this event emitter, with a reference of original user
     * @param aEvents {string[]}
     * @param user {User}
     * @private
     */
    _reemitUserEvent (aEvents, user) {
        for (const sEvent of aEvents) {
            user.events.on(sEvent, (payload) => {
                this._events.emit(sEvent, {
                    ...payload,
                    user
                });
            });
        }
    }

    /**
     * Specifically relevant for channels
     * Dispatches an incoming event to all users in the channel
     * @param aEvents {string[]}
     * @param channel {Channel}
     * @private
     */
    _dispatchChannelEvent (aEvents, channel) {
        for (const sEvent of aEvents) {
            channel.events.on(sEvent, (payload) => {
                for (const [, user] of channel.users) {
                    this._events.emit(sEvent, {
                        ...payload,
                        recipient: user.id
                    });
                }
            });
        }
    }

    /**
     * Creates a new channel
     * @param id {string}
     * @returns {Channel}
     */
    createChannel (id) {
        if (this.channelExists(id)) {
            throw new Error(`channel ${id} already exists`);
        }
        const channel = new Channel(id);
        channel.inject({ dateProvider: this._dateProvider });
        this._dispatchChannelEvent([
            EVENT_TYPES.EVENT_CHANNEL_MESSAGE,
            EVENT_TYPES.EVENT_USER_JOINED_CHANNEL,
            EVENT_TYPES.EVENT_USER_LEFT_CHANNEL,
            EVENT_TYPES.EVENT_USER_BANNED,
            EVENT_TYPES.EVENT_USER_UNBANNED
        ], channel);
        this._reemitChannelEvent([
            EVENT_TYPES.EVENT_USER_INSUFFICIENT_CAPABILITY
        ], channel);
        this._channels.set(channel.id, channel);
        return channel;
    }

    /**
     * Destroy channel after kicking all users out
     * @param id {string}
     */
    destroyChannel (id) {
        if (this.channelExists(id)) {
            const channel = this.getChannel(id);
            channel.close();
            this._channels.delete(id);
        } else {
            throw new Error(`this channel ${id} does not exist`);
        }
    }

    /**
     * Creates or reuse a user
     * @param id {string}
     * @returns {User}
     */
    createUser (id) {
        const user = new User(id);
        this._reemitUserEvent([
            EVENT_TYPES.EVENT_USER_RECEIVE_PRIVATE_MESSAGE
        ], user);
        return user;
    }

    /**
     * Returns instance of channel identified by specified parameter
     * @param idChannel {string}
     * @returns {Channel}
     */
    getChannel (idChannel) {
        if (this._channels.has(idChannel)) {
            return this._channels.get(idChannel);
        } else {
            throw new Error(`channel ${idChannel} does not exist`);
        }
    }

    /**
     * Return instance of user identified by specifed parameter
     * @param idUser
     * @returns {User}
     */
    getUser (idUser) {
        if (this._users.has(idUser)) {
            return this._users.get(idUser);
        } else {
            throw new Error(`user ${idUser} does not exist`);
        }
    }

    /**
     * A new user is connected, will reuse user instance if they have visited before.
     * @param idUser {string}
     * @return {User}
     */
    connectUser (idUser) {
        const user = this._disconnectedUser.has(idUser)
            ? this._disconnectedUser.get(idUser)
            : this.createUser(idUser);
        this._users.set(idUser, user);
        this._disconnectedUser.delete(idUser);
        user.connected = true;
        this._events.emit(EVENT_TYPES.EVENT_USER_CONNECTED, { user });
        return user;
    }

    /**
     * Disconnects a user from chat
     * however the user is not fully deleted, it is kept in disconnectedUsers map for future reuse
     * @param user {User}
     */
    disconnectUser (user) {
        const oFullState = this.getUserFullState(user);
        for (const channel of this.getChannelList()) {
            if (channel.users.has(user.id)) {
                channel.removeUser(user);
            }
        }
        this._disconnectedUser.set(user.id, user);
        this._users.delete(user.id);
        user.connected = false;
        this._events.emit(EVENT_TYPES.EVENT_USER_DISCONNECTED, { user, state: oFullState });
    }

    /**
     * @typedef TxatUserFullState {object}
     * @property user {TxatUserState}
     * @property bans {TxatBanState}
     *
     * @param user {User}
     * @returns {TxatUserFullState}
     */
    getUserFullState (user) {
        const oUserState = user.state;
        const aBanState = [];
        for (const channel of this.getChannelList()) {
            const ban = channel.bans.get(user.id);
            if (ban) {
                aBanState.push(ban.state);
            }
        }
        return {
            user: oUserState,
            bans: aBanState
        };
    }

    /**
     * Checks if user has the specified capability
     * @param user
     * @param channel
     * @param capability
     */
    checkChannelUserCapability (user, channel, capability) {
        const userRank = channel.getUserRank(user);
        if (!userRank.capabilities.has(capability)) {
            throw new Error(`User ${user.id} can't perform this operation on channel ${channel.id} ; insufficient capabilities ; need ${capability}.`);
        }
    }

    /** ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ***** */
    /** ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ***** */
    /** ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ****** USE CASES ***** */

    /**
     * /join <channel>
     *
     * Makes a user join a channel,
     * if channel does not exist : create it and make user channel host
     * @param user {User}
     * @param idChannel {string}
     * @return {boolean} true if users join channel, false if user cannot join because banned, or private channel
     */
    userJoinsChannel (user, idChannel) {
        if (!this.channelExists(idChannel)) {
            const channel = this.createChannel(idChannel);
            channel.addUser(user);
            channel.setUserRank(user, USER_RANKS.USER_RANK_HOST);
            return true;
        }
        const channel = this.getChannel(idChannel);
        if (channel.public) {
            if (!channel.addUser(user)) {
                throw new Error(`user ${user.id} could not join channel ${channel.id} because banned`);
            }
        } else {
            throw new Error(`user ${user.id} could not join channel ${channel.id} because channel is private, must ask for invitation`);
        }
    }

    /**
     * /leave <channel>
     *
     * Makes a user leaving a channel
     * @param user {User}
     * @param channel {Channel}
     */
    userLeavesChannel (user, channel) {
        channel.removeUser(user);
        if (channel.users.size === 0 && !channel.permanent) {
            this._channels.delete(channel.id);
        }
    }

    /**
     * /say <message>
     *
     * Makes a user send a public message to a channel
     * @param user {User}
     * @param channel {Channel}
     * @param text {string}
     */
    userSendsChannelMessage (user, channel, text) {
        channel.postMessage(user, text);
    }

    /**
     * Makes a user sens a private message to another user
     * @param user {User}
     * @param userDest {User}
     * @param text {string}
     */
    userSendsPrivateMessage (user, userDest, text) {
        const message = new Message(text, user);
        userDest.receivePrivateMessage(message);
    }

    /**
     * A promoter changes a user rank within a channel
     * @param user {User} the user whose rank is changed
     * @param channel {Channel} the channel where user and promoter are chatting
     * @param rank {string} new rank
     * @param promoter {User} the user who is promoting
     */
    setUserRank (user, channel, rank, promoter) {
        this.checkChannelUserCapability(user, channel, CAPABILITIES.CAPABILITY_PROMOTE);
        const promoterRank = channel.getUserRank(promoter);
        const userRank = channel.getUserRank(user);
        if (userRank.rank < promoterRank.rank) {
            channel.setUserRank(user, rank);
        }
    }

    /**
     * Bans a user for a specified duration, reason
     * @param user {User} user being banned
     * @param channel {Channel}
     * @param duration {string}
     * @param reason {string} reason why user is banned
     * @param banner {User}
     */
    banUser (user, channel, duration, reason, banner) {
        this.checkChannelUserCapability(banner, channel, CAPABILITIES.CAPABILITY_BAN);
        if (duration === 'forever' || duration === 'permanent' || duration === 'perm') {
            channel.banUser(user, reason, { permanent: true });
        } else if (duration.match(/^[0-9]+\s+[a-zA-Z]+$/)) {
            channel.banUser(user, reason, { duration: duration });
        } else {
            channel.banUser(user, reason, { date: duration.trim() });
        }
    }

    /**
     * Unbans a user from a specific channel
     * @param user {User}
     * @param channel {Channel}
     * @param unbanner {User}
     */
    unbanUser (user, channel, unbanner) {
        this.checkChannelUserCapability(unbanner, channel, CAPABILITIES.CAPABILITY_UNBAN);
        channel.unbanUser(user);
    }

    /**
     * Ignores a user
     * @param user {User}
     * @param ignoredUser {User}
     */
    ignoreUser (user, ignoredUser) {
        user.addIgnore(ignoredUser);
    }

    /**
     * Unignore user
     * @param user {User}
     * @param ignoredUser {User}
     */
    unignoreUser (user, ignoredUser) {
        user.removeIgnore(ignoredUser);
    }
}

module.exports = TxatManager;
