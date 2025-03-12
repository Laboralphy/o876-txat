const Channel = require('./Channel');
const CAPABILITIES = require('./data/capabilities.json');

class TxatManager {
    constructor () {
        this._channels = new Map();
        this._users = new Map();
    }

    channelExists (idChannel) {
        return this._channels.has(idChannel);
    }

    getChannelList () {
        return this._channels.values();
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
     * @param idUser {string}
     * @param idChannel {string}
     */
    userJoinsChannel (idUser, idChannel) {
        const user = this.getUser(idUser);
        if (!this.channelExists(idChannel)) {
            const channel = new Channel(idChannel);
            channel.addUser(user);
            const up = channel.getUserPower(user);
            up.add(CAPABILITIES.CAPABILITY_HOST);
            up.add(CAPABILITIES.CAPABILITY_SAY);
            up.add(CAPABILITIES.CAPABILITY_BAN);
            up.add(CAPABILITIES.CAPABILITY_UNBAN);
            up.add(CAPABILITIES.CAPABILITY_MUTE);
            up.add(CAPABILITIES.CAPABILITY_UNMUTE);
        }
        const channel = this.getChannel(idChannel);
        channel.addUser(user);
    }
}
