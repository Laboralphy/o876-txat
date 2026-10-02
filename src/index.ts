export { System } from './System';
export { Channel } from './Channel';
export { UserPresence } from './UserPresence';
export { POWERS } from './powers';
export { Message } from './Message';
export { User } from './User';
export { TXAT_EVENTS } from './events';
export { CHANNEL_ATRIBUTES } from './channel-attributes';

// events types — `export type` so strict ESM linking doesn't look for a runtime
// binding these type-only DTOs don't have (server is `type: module`).
export type { ChannelLeftDto } from './event-dto/channel-left';
export type { ChannelJoinedDto } from './event-dto/channel-joined.dto';
export type { ChannelClosedDto } from './event-dto/channel-closed.dto';
export type { MessagePostDto } from './event-dto/message-post.dto';
export type { YouLeftDto } from './event-dto/you-left';
export type { YouJoinedDto } from './event-dto/you-joined';
