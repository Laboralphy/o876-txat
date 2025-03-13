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
        this._channels = new Map();
        this._users = new Map();
        this._disconnectedUser = new Map();
        this._events = new Events();
        this._dateProvider = new StdDateProvider();
    }

    channelExists (idChannel) {
        return this._channels.has(idChannel);
    }

    userExists (idUser) {
        return this._users.has(idUser);
    }

    getChannelList () {
        return this._channels.values();
    }

    reemitEvent (aEvents, oObjectWithEvent, additionalPayload = {}) {
        for (const sEvent of aEvents) {
            oObjectWithEvent.events.on(sEvent, (payload) => {
                this._events.emit(sEvent, {
                    ...payload,
                    ...additionalPayload
                });
            });
        }
    }

    createChannel (id) {
        const c = new Channel(id);
        c.inject({ dateProvider: this._dateProvider });
        this.reemitEvent([
            EVENT_TYPES.EVENT_CHANNEL_MESSAGE,
            EVENT_TYPES.EVENT_USER_INSUFFICIENT_CAPABILITY,
            EVENT_TYPES.EVENT_USER_JOINED_CHANNEL,
            EVENT_TYPES.EVENT_USER_LEFT_CHANNEL,
            EVENT_TYPES.EVENT_USER_BANNED,
            EVENT_TYPES.EVENT_USER_UNBANNED
        ], c, { channel: c });
        return c;
    }

    createUser (id) {
        const user = new User(id);
        this.reemitEvent([
            EVENT_TYPES.EVENT_USER_RECEIVE_PRIVATE_MESSAGE
        ], user, { user });
        return user;
    }

    getChannel (idChannel) {
        if (this._channels.has(idChannel)) {
            return this._channels.get(idChannel);
        } else {
            throw new Error(`channel ${idChannel} does not exist`);
        }
    }

    getUser (idUser) {
        if (this._users.has(idUser)) {
            return this._users.get(idUser);
        } else {
            throw new Error(`user ${idUser} does not exist`);
        }
    }

    /**
     * Makes a user join a channel,
     * if channel does not exist : create it and make user channel host
     * @param user {User}
     * @param idChannel {string}
     */
    userJoinsChannel (user, idChannel) {
        if (!this.channelExists(idChannel)) {
            const channel = this.createChannel(idChannel);
            channel.addUser(user);
            channel.setUserRank(user, USER_RANKS.USER_RANK_HOST);
        }
        const channel = this.getChannel(idChannel);
        channel.addUser(user);
    }

    userLeavesChannel (user, channel) {
        channel.removeUser(user);
        if (channel.users.size === 0 && !channel.permanent) {
            this._channels.delete(channel.id);
        }
    }

    userSendsChannelMessage (user, channel, text) {
        channel.postMessage(user, text);
    }

    userSendsPrivateMessage (user, userDest, text) {
        const message = new Message(text, user);
        userDest.receivePrivateMessage(message);
    }

    checkChannelUserCapability (user, channel, capability) {
        const userRank = channel.getUserRank(user);
        if (!userRank.capabilities.has(CAPABILITIES.CAPABILITY_PROMOTE)) {
            throw new Error(`User ${user.id} can't perform this operation on channel ${channel.id} ; insufficient capabilities ; need ${CAPABILITIES.CAPABILITY_PROMOTE}.`);
        }
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
        this.checkChannelUserCapability(user, channel, CAPABILITIES.CAPABILITY_BAN);
        if (duration === 'forever' || duration === 'permanent' || duration === 'perm') {
            const b = channel.banUser(user, reason, { permanent: true });

        } else if (duration.match(/^[0-9]+\s+[a-zA-Z]+$/)) {
            channel.banUser(user, reason, { duration: duration });
        } else {
            channel.banUser(user, reason, { date: duration.trim() });
        }
    }

    connectUser (idUser) {
        if (this._disconnectedUser.has(idUser)) {
            const user = this._disconnectedUser.get(idUser);
            this._users.set(idUser, user);
            this._disconnectedUser.delete(idUser);
            user.connected = true;
        } else {
            const user = this.createUser(idUser);
            this._users.set(idUser, user);
            user.connected = true;
        }
    }

    disconnectUser (user) {
        this._disconnectedUser.set(user.id, user);
        this._users.delete(user.id);
        user.connected = false;
    }
}

module.exports = TxatManager;
