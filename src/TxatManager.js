const Channel = require('./Channel');
const User = require('./User');
const USER_RANKS = require('./data/user-ranks.json');
const Events = require('events');
const StdDateProvider = require('./date-provider/StdDateProvider');
const EVENT_TYPES = require('./data/event-types.json');
const CAPABILITIES = require('./data/capabilities.json');
const Message = require('./Message');
const userRanks = require('./user-ranks');


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
                    recipient: user.id
                });
            });
        }
    }

    /**
     * @param channel {Channel}
     * @private
     */
    _dispatchMessageEvent (channel) {
        /**
         * @param message {Message}
         */
        channel.events.on(EVENT_TYPES.EVENT_CHANNEL_MESSAGE, ({ message }) => {
            for (const [, user] of channel.users) {
                if (!user.isIgnoring(message.sender)) {
                    this._events.emit(EVENT_TYPES.EVENT_CHANNEL_MESSAGE, {
                        message,
                        channel,
                        recipient: user.id
                    });
                }
            }
        });
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
                        channel,
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
        this._dispatchMessageEvent(channel);
        this._dispatchChannelEvent([
            EVENT_TYPES.EVENT_USER_JOINED_CHANNEL,
            EVENT_TYPES.EVENT_USER_LEFT_CHANNEL,
            EVENT_TYPES.EVENT_USER_BANNED,
            EVENT_TYPES.EVENT_USER_UNBANNED,
            EVENT_TYPES.EVENT_USER_INVITED
        ], channel);
        this._reemitChannelEvent([
            EVENT_TYPES.EVENT_USER_INSUFFICIENT_CAPABILITY
        ], channel);
        this._channels.set(channel.id, channel);
        this._events.emit(EVENT_TYPES.EVENT_CHANNEL_CREATED, { channel });
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
            this._events.emit(EVENT_TYPES.EVENT_CHANNEL_DESTROYED, { channel });
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
        } else if (this._disconnectedUser.has(idUser)) {
            return this._disconnectedUser.get(idUser);
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
            const ban = channel._bans.get(user.id);
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
            throw new Error(`user ${user.id} can't perform this operation on channel ${channel.id} ; insufficient capabilities ; need ${capability}`);
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
     * @param channelOrId {string|Channel}
     * @return {boolean} true if users join channel, false if user cannot join because banned, or private channel
     */
    userJoinsChannel (user, channelOrId) {
        let channel;
        if (typeof channelOrId === 'string') {
            const idChannel = channelOrId;
            if (this.channelExists(idChannel)) {
                channel = this.getChannel(idChannel);
            } else {
                const channel = this.createChannel(idChannel);
                channel.addUser(user);
                channel.setUserRank(user, USER_RANKS.USER_RANK_HOST);
                return true;
            }
        } else if (channelOrId instanceof Channel) {
            channel = channelOrId;
        } else {
            throw new TypeError('parameter should be either Channel instance or string');
        }
        if (channel.public || channel.getUserRank(user).capabilities.has(CAPABILITIES.CAPABILITY_JOIN_PRIVATE)) {
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
        return channel.postMessage(user, text);
    }

    /**
     * Makes a user sens a private message to another user
     * @param user {User}
     * @param userDest {User}
     * @param text {string}
     */
    userSendsPrivateMessage (user, userDest, text) {
        const message = new Message(text, user, this._dateProvider.now().getTime());
        userDest.receivePrivateMessage(message);
    }

    /**
     * A promoter changes a user rank within a channel
     * @param promotedUser {User} the user whose rank is changed
     * @param channel {Channel} the channel where user and promoter are chatting
     * @param rank {string} new rank
     * @param user {User} the user who is promoting
     */
    setUserRank (user, channel, promotedUser, rank, ) {
        this.checkChannelUserCapability(user, channel, CAPABILITIES.CAPABILITY_PROMOTE);
        const newRank = userRanks[rank];
        if (!newRank) {
            throw new Error(`unknown rank id ${rank}`);
        }
        const promoterRank = channel.getUserRank(user);
        const userCurrentRank = channel.getUserRank(promotedUser);
        if (userCurrentRank.index < promoterRank.index && newRank.index <= promoterRank.index) {
            channel.setUserRank(promotedUser, rank);
            return true;
        }
        if (userCurrentRank.index >= promoterRank.index) {
            throw new Error(`user rank is greater or equal than promoter rank ; user ${userCurrentRank.id} - promoter ${promoterRank.id}`);
        }
        if (newRank.index > promoterRank.index) {
            throw new Error(`new rank would be higher than promoter rank ; promoter ${promoterRank.id} - target rank ${newRank.id}`);
        }
    }

    /**
     * Bans a user for a specified duration, reason
     * @param bannedUser {User} user being banned
     * @param channel {Channel}
     * @param duration {string}
     * @param reason {string} reason why user is banned
     * @param user {User}
     */
    banUser (user, channel, bannedUser, duration, reason) {
        this.checkChannelUserCapability(user, channel, CAPABILITIES.CAPABILITY_BAN);
        if (duration === 'forever' || duration === 'permanent' || duration === 'perm') {
            channel.banUser(bannedUser, reason, { permanent: true });
        } else if (duration.match(/^[0-9]+\s+[a-zA-Z]+$/)) {
            channel.banUser(bannedUser, reason, { duration: duration });
        } else {
            channel.banUser(bannedUser, reason, { date: duration.trim() });
        }
    }

    /**
     * Unbans a user from a specific channel
     * @param bannedUser {User}
     * @param channel {Channel}
     * @param user {User}
     */
    unbanUser (user, channel, bannedUser) {
        this.checkChannelUserCapability(user, channel, CAPABILITIES.CAPABILITY_UNBAN);
        channel.unbanUser(bannedUser);
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

    /**
     * Set a new name for a channel
     * @param user {User}
     * @param channel {Channel}
     * @param sName {string}
     */
    setChannelName (user, channel, sName) {
        this.checkChannelUserCapability(user, CAPABILITIES.CAPABILITY_MANAGE_CHANNEL);
        channel.name = sName;
    }

    /**
     * Set channel public flag
     * @param user {User}
     * @param channel {Channel}
     * @param bPublic {boolean}
     */
    setChannelAccess (user, channel, bPublic) {
        this.checkChannelUserCapability(user, CAPABILITIES.CAPABILITY_MANAGE_CHANNEL);
        channel.public = bPublic;
    }

    inviteUser (user, channel, guest) {
        this.checkChannelUserCapability(user, channel, CAPABILITIES.CAPABILITY_INVITE);
        if (!channel.isUserBanned(user) && !channel.isUserBanned(guest)) {
            if (channel.addUser(user)) {
                channel.events.emit(EVENT_TYPES.EVENT_USER_INVITED, {
                    user: guest,
                    channel,
                    inviter: user
                });
            }
        }
    }
}

module.exports = TxatManager;
