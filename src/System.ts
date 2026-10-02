import { Channel } from './Channel';
import { EventEmitter } from 'node:events';
import { CHANNEL_ATRIBUTES } from './channel-attributes';
import { POWERS } from './powers';
import { User } from './User';
import { TXAT_EVENTS } from './events';
import type { MessagePostDto } from './event-dto/message-post.dto';
import type { ChannelClosedDto } from './event-dto/channel-closed.dto';
import type { ChannelJoinedDto } from './event-dto/channel-joined.dto';
import type { YouLeftDto } from './event-dto/you-left';
import type { YouJoinedDto } from './event-dto/you-joined';
import type { ChannelLeftDto } from './event-dto/channel-left';

export class System {
    private readonly channels = new Map<string, Channel>();
    private readonly _events = new EventEmitter();
    private readonly users = new Map<string, User>();

    constructor() {}

    get events(): EventEmitter {
        return this._events;
    }

    getUser(idUser: string): User {
        const user = this.users.get(idUser);
        if (user) {
            return user;
        } else {
            throw new ReferenceError(`User ${idUser} not registered in chat system`);
        }
    }

    postMessage(idSender: string, idChannel: string, message: string) {
        this.getChannel(idChannel).postMessage(idSender, message);
    }

    /**
     * Adds a new channel to the system
     * @param id channel identifier
     * @param tag
     */
    addChannel(id: string, tag: string = ''): Channel {
        if (!this.channels.has(id)) {
            const channel = new Channel(id, tag);
            channel.events.on(TXAT_EVENTS.JOINED, ({ recv }) => {
                const dto: YouJoinedDto = {
                    recv,
                    channel,
                };
                this._events.emit(TXAT_EVENTS.YOU_JOINED, dto);
            });
            channel.events.on(TXAT_EVENTS.LEFT, ({ recv }) => {
                const dto: YouLeftDto = {
                    recv,
                    channel,
                };
                this._events.emit(TXAT_EVENTS.YOU_LEFT, dto);
            });
            channel.events.on(TXAT_EVENTS.USER_JOINED, ({ recv, user }) => {
                const dto: ChannelJoinedDto = {
                    recv,
                    user,
                    channel,
                };
                this._events.emit(TXAT_EVENTS.USER_JOINED, dto);
            });
            channel.events.on(TXAT_EVENTS.USER_LEFT, ({ recv, user }) => {
                const dto: ChannelLeftDto = {
                    recv,
                    channel,
                    user,
                };
                this._events.emit(TXAT_EVENTS.USER_LEFT, dto);
                if (
                    !channel.attributes.has(CHANNEL_ATRIBUTES.PERSISTANT) &&
                    channel.users.length <= 0
                ) {
                    this.removeChannel(id);
                }
            });
            channel.events.on(TXAT_EVENTS.MESSAGE_POST, ({ recv, user, message }) => {
                const dto: MessagePostDto = {
                    recv,
                    channel,
                    user,
                    message,
                };
                this._events.emit(TXAT_EVENTS.MESSAGE_POST, dto);
            });
            channel.events.on(TXAT_EVENTS.CLOSED, ({ recv }) => {
                const dto: ChannelClosedDto = {
                    channel,
                    recv,
                };
                this._events.emit(TXAT_EVENTS.CLOSED, dto);
            });
            this.channels.set(id, channel);
            return channel;
        } else {
            throw new Error(`Channel id ${id} already exists`);
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
            return channel;
        } else {
            throw new Error(`Channel id ${id} does not exist`);
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
            throw new Error(`Channel id ${id} not found`);
        }
        return channel;
    }

    /**
     * Returns all created channels
     */
    getChannelList() {
        return Array.from(this.channels.values()).filter(
            (channel) => !channel.attributes.has(CHANNEL_ATRIBUTES.HIDDEN)
        );
    }

    /**
     * A user will joinne an existing channel
     * (both user and channel must exist)
     * @param idUser
     * @param idChannel
     */
    userJoinChannel(idUser: string, idChannel: string): Channel {
        const user = this.getUser(idUser);
        const channel = this.getChannel(idChannel);
        if (user.joinedChannels.has(channel)) {
            throw new Error(`user ${idUser} is already on channel ${idChannel}`);
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
        channel.addUser(idUser).grant(POWERS.READ).grant(POWERS.WRITE);
        user.joinedChannels.add(channel);
        return channel;
    }

    /**
     * An existing user is leaving a channel
     * @param idUser
     * @param idChannel
     */
    userLeaveChannel(idUser: string, idChannel: string) {
        const user = this.getUser(idUser);
        const channel = this.getChannel(idChannel);
        if (!channel) {
            throw new Error(`Channel id ${idChannel} does not exist`);
        }
        channel.removeUser(idUser);
        user.joinedChannels.delete(channel);
    }

    /**
     * Register a new user in the system
     * @param id
     * @param name
     */
    registerUser(id: string, name: string = '') {
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
        user.joinedChannels.forEach((channel) => {
            channel.removeUser(idUser);
        });
        this.users.delete(idUser);
    }
}
