import { UserPresence } from '../UserPresence';
import { Channel } from '../Channel';

export type ChannelLeftDto = {
    recv: string;
    channel: Channel;
    user: UserPresence;
};
