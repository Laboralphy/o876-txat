export class Message {
    /**
     * @param idChannel channel the message was posted on
     * @param idUser posting user id
     * @param content message content
     * @param ts timestamp (ms)
     * @param id unique message identifier
     */
    constructor(
        public readonly idChannel: string,
        public readonly idUser: string,
        public readonly content: string,
        public readonly ts: number = Date.now(),
        public readonly id: string = crypto.randomUUID()
    ) {}
}
