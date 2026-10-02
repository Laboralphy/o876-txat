export { System } from './System';
export { Channel } from './Channel';
export { UserPresence } from './UserPresence';
export { User } from './User';
export { Message } from './Message';
export { POWERS } from './powers';
export { CHANNEL_ATTRIBUTES } from './channel-attributes';
export { TXAT_EVENTS, LEAVE_REASONS } from './events';
export { TypedEmitter } from './TypedEmitter';

// events types — `export type` so strict ESM linking doesn't look for a runtime
// binding these type-only DTOs don't have.
export type { Listener, ErrorHandler, TypedEmitterOptions } from './TypedEmitter';
export type {
    TxatEventMap,
    PresenceDto,
    YouJoinedDto,
    YouLeftDto,
    UserJoinedDto,
    UserLeftDto,
    MessagePostDto,
    ChannelClosedDto,
} from './events';
