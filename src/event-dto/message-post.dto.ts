import { UserPresence } from '../UserPresence';
import { Channel } from '../Channel';
import { Message } from '../Message';

export type MessagePostDto = {
    recv: string;
    channel: Channel;
    user: UserPresence;
    message: Message;
};
