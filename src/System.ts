import { Channel, type ChannelOptions } from './Channel';
import { CHANNEL_ATTRIBUTES } from './channel-attributes';
import { User } from './User';
import { TXAT_EVENTS, type TxatEventMap } from './events';
import { TypedEmitter } from './TypedEmitter';
import type { Message } from './Message';
import { TXAT_ERRORS, TxatError } from './errors';

export class System {
    private readonly channels = new Map<string, Channel>();
    private readonly _events = new TypedEmitter<TxatEventMap>();
    private readonly users = new Map<string, User>();

    get events(): TypedEmitter<TxatEventMap> {
        return this._events;
    }

    getUser(idUser: string): User {
        const user = this.users.get(idUser);
        if (user) {
            return user;
        } else {
            throw new TxatError(
                TXAT_ERRORS.USER_NOT_FOUND,
                `User ${idUser} not registered in chat system`
            );
        }
    }

    postMessage(idSender: string, idChannel: string, message: string): Message {
        return this.getChannel(idChannel).postMessage(idSender, message);
    }

    /**
     * Re-emit a channel event on the system emitter
     */
    private forward<K extends keyof TxatEventMap>(channel: Channel, event: K) {
        channel.events.on(event, (dto) => this._events.emit(event, dto));
    }

    /**
     * Subscribe to channel events : keeps users joined channel lists in sync,
     * removes empty non-persistent channels, and re-emits every event
     */
    private watchChannel(channel: Channel) {
        channel.events.on(TXAT_EVENTS.YOU_JOINED, (dto) => {
            this.users.get(dto.recv)?.joinedChannels.add(channel);
            this._events.emit(TXAT_EVENTS.YOU_JOINED, dto);
        });
        channel.events.on(TXAT_EVENTS.YOU_LEFT, (dto) => {
            this.users.get(dto.recv)?.joinedChannels.delete(channel);
            this._events.emit(TXAT_EVENTS.YOU_LEFT, dto);
            // a non-persistent channel disappears when its last user leaves
            if (
                !channel.attributes.has(CHANNEL_ATTRIBUTES.PERSISTENT) &&
                channel.users.length <= 0 &&
                this.channels.get(channel.id) === channel
            ) {
                this.removeChannel(channel.id);
            }
        });
        channel.events.on(TXAT_EVENTS.CLOSED, (dto) => {
            this.users.get(dto.recv)?.joinedChannels.delete(channel);
            this._events.emit(TXAT_EVENTS.CLOSED, dto);
        });
        this.forward(channel, TXAT_EVENTS.USER_JOINED);
        this.forward(channel, TXAT_EVENTS.USER_LEFT);
        this.forward(channel, TXAT_EVENTS.MESSAGE_POST);
        this.forward(channel, TXAT_EVENTS.POWER_CHANGED);
    }

    /**
     * Adds a new channel to the system
     * @param id channel identifier
     * @param options tag, persistence, visibility, history size, default powers
     */
    addChannel(id: string, options: ChannelOptions = {}): Channel {
        if (!this.channels.has(id)) {
            const channel = new Channel(id, options);
            this.watchChannel(channel);
            this.channels.set(id, channel);
            return channel;
        } else {
            throw new TxatError(
                TXAT_ERRORS.CHANNEL_ALREADY_EXISTS,
                `Channel id ${id} already exists`
            );
        }
    }

    /**
     * Removes a previously created channel from the system
     * @param id channel identifier
     */
    removeChannel(id: string) {
        const channel = this.channels.get(id);
        if (channel) {
            channel.close();
            this.channels.delete(id);
            channel.events.removeAllListeners();
            return channel;
        } else {
            throw new TxatError(TXAT_ERRORS.CHANNEL_NOT_FOUND, `Channel id ${id} does not exist`);
        }
    }

    /**
     * Returns true if the specified channel id exists
     * @param id channel identifer
     * @return boolean
     */
    isChannelExists(id: string): boolean {
        return this.channels.has(id);
    }

    /**
     * Return a channel instance
     * throws an error if specified identifier does not correspond to a channel
     * @param id
     */
    getChannel(id: string) {
        const channel = this.channels.get(id);
        if (!channel) {
            throw new TxatError(TXAT_ERRORS.CHANNEL_NOT_FOUND, `Channel id ${id} not found`);
        }
        return channel;
    }

    /**
     * Returns all created channels
     */
    getChannelList() {
        return Array.from(this.channels.values()).filter(
            (channel) => !channel.attributes.has(CHANNEL_ATTRIBUTES.HIDDEN)
        );
    }

    /**
     * A user joins an existing channel, with the channel default powers
     * (both user and channel must exist)
     * @param idUser
     * @param idChannel
     */
    userJoinChannel(idUser: string, idChannel: string): Channel {
        const user = this.getUser(idUser);
        const channel = this.getChannel(idChannel);
        if (user.joinedChannels.has(channel)) {
            throw new TxatError(
                TXAT_ERRORS.USER_ALREADY_ON_CHANNEL,
                `User ${idUser} is already on channel ${idChannel}`
            );
        }
        // check access before leaving any tagged channel, so a denied join leaves user untouched
        if (!channel.isAllowed(idUser)) {
            throw new TxatError(
                TXAT_ERRORS.ACCESS_DENIED,
                `User ${idUser} is not allowed to access channel ${idChannel}`
            );
        }
        // try to determine if the new channel is a tagged one
        const sTag = channel.tag;
        if (sTag != '') {
            // this channel has a tag : if user is already in another channel with the same tag
            // leaver the former channel
            const aJoinedChannels: Channel[] = Array.from(user.joinedChannels);
            aJoinedChannels
                .filter((channel) => channel.tag == sTag)
                .forEach((channel) => {
                    this.userLeaveChannel(user.id, channel.id);
                });
        }
        // joined channel list is updated by the YOU_JOINED handler, before listeners are called
        channel.addUser(idUser, { name: user.name });
        return channel;
    }

    /**
     * An existing user is leaving a channel
     * throws an error if the user is not on this channel
     * @param idUser
     * @param idChannel
     */
    userLeaveChannel(idUser: string, idChannel: string) {
        this.getUser(idUser);
        this.getChannel(idChannel).removeUser(idUser);
    }

    /**
     * Register a new user in the system
     * @param id
     * @param name
     */
    registerUser(id: string, name: string = '') {
        if (this.users.has(id)) {
            throw new TxatError(
                TXAT_ERRORS.USER_ALREADY_REGISTERED,
                `User ${id} is already registered in chat system`
            );
        }
        const user = new User(id, name === '' ? id : name);
        this.users.set(id, user);
        return user;
    }

    /**
     * Return true if user is properly registrered
     * @param idUser
     */
    isUserRegistered(idUser: string): boolean {
        return this.users.has(idUser);
    }

    /**
     * Unregister a user, and make it leave all channels
     * @param idUser
     */
    unregisterUser(idUser: string) {
        // remove this user from all joined channels
        const user = this.getUser(idUser);
        Array.from(user.joinedChannels).forEach((channel) => {
            this.userLeaveChannel(idUser, channel.id);
        });
        this.users.delete(idUser);
    }
}
