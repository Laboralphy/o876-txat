import { UserPresence } from '../UserPresence';
import { Channel } from '../Channel';

export type ChannelJoinedDto = {
    recv: string;
    channel: Channel;
    user: UserPresence;
};
