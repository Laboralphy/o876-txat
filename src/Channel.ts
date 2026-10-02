import { UserPresence } from './UserPresence';
import { POWERS } from './powers';
import { Message } from './Message';
import { CHANNEL_ATTRIBUTES } from './channel-attributes';
import { LEAVE_REASONS, TXAT_EVENTS, type TxatEventMap } from './events';
import { TypedEmitter } from './TypedEmitter';
import { TXAT_ERRORS, TxatError } from './errors';

export type ChannelOptions = {
    /**
     * Exclusivity tag : a user cannot be on two channels of the same tag
     */
    tag?: string;
    /**
     * A persistent channel does not disappear when all users leave
     */
    persistent?: boolean;
    /**
     * A hidden channel is not listed
     */
    hidden?: boolean;
    /**
     * Number of messages kept in history (default 1000)
     */
    maxLines?: number;
    /**
     * Powers granted to joining users (default READ and WRITE)
     */
    defaultPowers?: Iterable<POWERS>;
};

export type AddUserOptions = {
    /**
     * Powers granted before join events are emitted (default : channel default powers)
     */
    powers?: Iterable<POWERS>;
    /**
     * User display name (default : user id)
     */
    name?: string;
};

export class Channel {
    private readonly _users = new Map<string, UserPresence>();
    private readonly messages: Message[] = [];
    private readonly _events = new TypedEmitter<TxatEventMap>();
    private readonly _whiteList = new Set<string>();
    private readonly _blackList = new Set<string>();
    private _maxLines: number;
    public readonly tag: string;
    public readonly attributes = new Set<CHANNEL_ATTRIBUTES>();
    /**
     * Powers granted to users joining this channel
     */
    public readonly defaultPowers: Set<POWERS>;

    constructor(
        public readonly id: string,
        {
            tag = '',
            persistent = false,
            hidden = false,
            maxLines = 1000,
            defaultPowers = [POWERS.READ, POWERS.WRITE],
        }: ChannelOptions = {}
    ) {
        this.tag = tag;
        this._maxLines = maxLines;
        this.defaultPowers = new Set(defaultPowers);
        if (persistent) {
            this.attributes.add(CHANNEL_ATTRIBUTES.PERSISTENT);
        }
        if (hidden) {
            this.attributes.add(CHANNEL_ATTRIBUTES.HIDDEN);
        }
    }

    /**
     * Return the event emitter instance
     */
    get events(): TypedEmitter<TxatEventMap> {
        return this._events;
    }

    get users(): UserPresence[] {
        return Array.from(this._users.values());
    }

    getUser(id: string): UserPresence | undefined {
        return this._users.get(id);
    }

    /**
     * Number of messages kept in history ; lowering it trims the history at once
     */
    get maxLines(): number {
        return this._maxLines;
    }

    set maxLines(value: number) {
        this._maxLines = value;
        this.trimMessages(0);
    }

    /**
     * Drop oldest messages until there is room for `room` new messages
     */
    private trimMessages(room: number) {
        const excess = this.messages.length + room - this._maxLines;
        if (excess > 0) {
            this.messages.splice(0, excess);
        }
    }

    /**
     * Users allowed to access this channel ; when not empty, this channel is private
     * Use allow() / disallow() to modify
     */
    get whiteList(): ReadonlySet<string> {
        return this._whiteList;
    }

    /**
     * Users banned from this channel
     * Use ban() / unban() to modify
     */
    get blackList(): ReadonlySet<string> {
        return this._blackList;
    }

    /**
     * Return true if this channel is not open to anyone
     */
    get private(): boolean {
        return this._whiteList.size > 0;
    }

    /**
     * one user cannot join two channels of the same tag
     */
    get tagged(): boolean {
        return this.tag !== '';
    }

    /**
     * Return true if the specified user is allowed to join this channel
     * (not blacklisted, and whitelisted if this channel is private)
     * @param idUser user id
     */
    isAllowed(idUser: string): boolean {
        return !this._blackList.has(idUser) && (!this.private || this._whiteList.has(idUser));
    }

    /**
     * Ban a user from this channel ; the user is kicked if present
     * @param idUser user id
     */
    ban(idUser: string) {
        this._blackList.add(idUser);
        this.expelDisallowedUsers();
    }

    /**
     * Lift a user ban
     * @param idUser user id
     */
    unban(idUser: string) {
        this._blackList.delete(idUser);
    }

    /**
     * Add a user to the white list, making this channel private ;
     * present users who are not white listed are kicked
     * @param idUser user id
     */
    allow(idUser: string) {
        this._whiteList.add(idUser);
        this.expelDisallowedUsers();
    }

    /**
     * Remove a user from the white list ; the user is kicked if present and the channel
     * remains private
     * @param idUser user id
     */
    disallow(idUser: string) {
        this._whiteList.delete(idUser);
        this.expelDisallowedUsers();
    }

    /**
     * Kick every present user who is no longer allowed to access this channel
     */
    private expelDisallowedUsers() {
        this.users
            .filter((u: UserPresence) => !this.isAllowed(u.id))
            .forEach((u: UserPresence) => this.removeUser(u.id, LEAVE_REASONS.KICKED));
    }

    /**
     * Adds a new user to this channel
     * This user will now be able to read channel content, and, if granted, write messages
     * @param idUser joining user id
     * @param options initial powers and display name
     * @return UserPresence the instance of user presence is return so another system may
     * update this instance to reflect user privileges on this channel
     */
    addUser(idUser: string, { powers = this.defaultPowers, name }: AddUserOptions = {}) {
        const user = this._users.get(idUser);
        if (user) {
            return user;
        } else {
            if (!this.isAllowed(idUser)) {
                throw new TxatError(
                    TXAT_ERRORS.ACCESS_DENIED,
                    `User ${idUser} is not allowed to access channel ${this.id}`
                );
            }
            const user = new UserPresence(idUser, name);
            for (const power of powers) {
                user.grant(power);
            }
            user.onPowerChange = (presence, power, granted) =>
                this._events.emit(TXAT_EVENTS.POWER_CHANGED, {
                    recv: presence.id,
                    idChannel: this.id,
                    user: presence.toJSON(),
                    power,
                    granted,
                });
            this._users.set(idUser, user);
            this._events.emit(TXAT_EVENTS.YOU_JOINED, { recv: idUser, idChannel: this.id });
            const snapshot = user.toJSON();
            this._users.forEach((u: UserPresence) => {
                if (u !== user) {
                    this._events.emit(TXAT_EVENTS.USER_JOINED, {
                        recv: u.id,
                        idChannel: this.id,
                        user: snapshot,
                    });
                }
            });
            return user;
        }
    }

    /**
     * Remove user presence from this channel
     * throws an error if the user is not present on this channel
     * @param idUser leaving user id
     * @param reason why the user is leaving
     * @return UserPresence client app should store this objet to keep track of user
     * privileges on this channel
     */
    removeUser(idUser: string, reason: LEAVE_REASONS = LEAVE_REASONS.LEFT) {
        const user = this._users.get(idUser);
        if (!user) {
            throw new TxatError(
                TXAT_ERRORS.USER_NOT_ON_CHANNEL,
                `User ${idUser} is not on channel ${this.id}`
            );
        }
        this._users.delete(idUser);
        user.onPowerChange = undefined;
        this._events.emit(TXAT_EVENTS.YOU_LEFT, { recv: idUser, idChannel: this.id, reason });
        const snapshot = user.toJSON();
        this._users.forEach((u: UserPresence) => {
            this._events.emit(TXAT_EVENTS.USER_LEFT, {
                recv: u.id,
                idChannel: this.id,
                user: snapshot,
                reason,
            });
        });
        return user;
    }

    /**
     * Remove a user from this channel, notifying them they have been kicked
     * The user may join again, unless banned
     * @param idUser user id
     */
    kick(idUser: string) {
        return this.removeUser(idUser, LEAVE_REASONS.KICKED);
    }

    /**
     * Post a new message on this channel.
     * @param idUser posting user id
     * @param content message content
     * @return Message the posted message
     */
    postMessage(idUser: string, content: string): Message {
        const user = this._users.get(idUser);
        if (!user) {
            throw new TxatError(
                TXAT_ERRORS.USER_NOT_ON_CHANNEL,
                `User ${idUser} is not on channel ${this.id}`
            );
        }
        if (!user.hasPower(POWERS.WRITE)) {
            throw new TxatError(
                TXAT_ERRORS.WRITE_DENIED,
                `User ${idUser} is not allowed to post message on channel ${this.id}`
            );
        }
        const message = new Message(this.id, idUser, content);
        this.trimMessages(1);
        this.messages.push(message);
        const snapshot = user.toJSON();
        this.users
            .filter((u: UserPresence) => u.hasPower(POWERS.READ))
            .forEach((u: UserPresence) => {
                this._events.emit(TXAT_EVENTS.MESSAGE_POST, {
                    recv: u.id,
                    idChannel: this.id,
                    user: snapshot,
                    message,
                });
            });
        return message;
    }

    /**
     * Close this channel, expel gracefully every body
     */
    close() {
        this._users.forEach((u: UserPresence) => {
            u.onPowerChange = undefined;
            this._events.emit(TXAT_EVENTS.CLOSED, {
                recv: u.id,
                idChannel: this.id,
            });
        });
        this._users.clear();
    }

    /**
     * Return the message history, oldest first
     */
    getMessages() {
        return this.messages.slice(0);
    }
}
