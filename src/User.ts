import { Channel } from './Channel';

export class User {
    public readonly joinedChannels = new Set<Channel>();
    constructor(
        public readonly id: string,
        public readonly name: string
    ) {}
}
