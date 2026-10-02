import type { Message } from './Message';
import type { POWERS } from './powers';

export enum TXAT_EVENTS {
    MESSAGE_POST = 'message.post',
    YOU_JOINED = 'you.joined',
    YOU_LEFT = 'you.left',
    USER_JOINED = 'user.joined',
    USER_LEFT = 'user.left',
    CLOSED = 'closed',
}

/**
 * Why a user is no longer present on a channel
 */
export enum LEAVE_REASONS {
    LEFT = 'left', // user left on their own
    KICKED = 'kicked', // user was kicked, or lost access (ban, access list change)
}

/**
 * Plain snapshot of a user presence on a channel, at the time of the event
 */
export type PresenceDto = {
    id: string;
    color: string;
    powers: POWERS[];
};

// Every event payload has a "recv" property : the id of the user the event must be delivered to

export type YouJoinedDto = {
    recv: string;
    idChannel: string;
};

export type YouLeftDto = {
    recv: string;
    idChannel: string;
    reason: LEAVE_REASONS;
};

export type UserJoinedDto = {
    recv: string;
    idChannel: string;
    user: PresenceDto;
};

export type UserLeftDto = {
    recv: string;
    idChannel: string;
    user: PresenceDto;
    reason: LEAVE_REASONS;
};

export type MessagePostDto = {
    recv: string;
    idChannel: string;
    user: PresenceDto;
    message: Message;
};

export type ChannelClosedDto = {
    recv: string;
    idChannel: string;
};

export interface TxatEventMap {
    [TXAT_EVENTS.MESSAGE_POST]: MessagePostDto;
    [TXAT_EVENTS.YOU_JOINED]: YouJoinedDto;
    [TXAT_EVENTS.YOU_LEFT]: YouLeftDto;
    [TXAT_EVENTS.USER_JOINED]: UserJoinedDto;
    [TXAT_EVENTS.USER_LEFT]: UserLeftDto;
    [TXAT_EVENTS.CLOSED]: ChannelClosedDto;
}
