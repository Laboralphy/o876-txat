import { UserPresence } from './UserPresence';
import { POWERS } from './powers';
import { Message } from './Message';
import { CHANNEL_ATTRIBUTES } from './channel-attributes';
import { LEAVE_REASONS, TXAT_EVENTS, type TxatEventMap } from './events';
import { TypedEmitter } from './TypedEmitter';

export class Channel {
    private readonly _users = new Map<string, UserPresence>();
    private readonly messages: Message[] = [];
    private readonly _events = new TypedEmitter<TxatEventMap>();
    private readonly _whiteList = new Set<string>();
    private readonly _blackList = new Set<string>();
    public maxLines: number = 1000;
    public readonly attributes = new Set<CHANNEL_ATTRIBUTES>();

    constructor(
        public readonly id: string,
        public readonly tag: string = ''
    ) {}

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
     * @param powers powers granted to the user before join events are emitted
     * @return UserPresence the instance of user presence is return so another system may
     * update this instance to reflect user privileges on this channel
     */
    addUser(idUser: string, powers: Iterable<POWERS> = []) {
        const user = this._users.get(idUser);
        if (user) {
            return user;
        } else {
            if (!this.isAllowed(idUser)) {
                throw new Error(`User ${idUser} is not allowed to access channel ${this.id}`);
            }
            const user = new UserPresence(idUser);
            for (const power of powers) {
                user.grant(power);
            }
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
            throw new Error(`User ${idUser} is not on channel ${this.id}`);
        }
        this._users.delete(idUser);
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
     * @param idUser postinng user id
     * @param content message content
     * @return Message the posted message
     */
    postMessage(idUser: string, content: string): Message {
        const user = this._users.get(idUser);
        if (user?.hasPower(POWERS.WRITE)) {
            const message = new Message(this.id, idUser, content);
            while (this.messages.length >= this.maxLines) {
                this.messages.shift();
            }
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
        } else {
            throw new Error(`User ${idUser} is not allowed to post message on channel ${this.id}`);
        }
    }

    /**
     * Close this channel, expel gracefully every body
     */
    close() {
        this._users.forEach((u: UserPresence) => {
            this._events.emit(TXAT_EVENTS.CLOSED, {
                recv: u.id,
                idChannel: this.id,
            });
        });
        this._users.clear();
    }

    /**
     * Return a list of nth last messages
     */
    getMessages() {
        return this.messages.slice(0);
    }
}
