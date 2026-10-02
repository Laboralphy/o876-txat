export class Message {
    constructor(
        public readonly idUser: string,
        public readonly content: string,
        public readonly ts: number
    ) {}
}
