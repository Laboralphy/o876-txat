export enum TXAT_ERRORS {
    USER_NOT_FOUND = 'user.not-found',
    USER_ALREADY_REGISTERED = 'user.already-registered',
    CHANNEL_NOT_FOUND = 'channel.not-found',
    CHANNEL_ALREADY_EXISTS = 'channel.already-exists',
    USER_ALREADY_ON_CHANNEL = 'user.already-on-channel',
    USER_NOT_ON_CHANNEL = 'user.not-on-channel',
    ACCESS_DENIED = 'access.denied',
    WRITE_DENIED = 'write.denied',
}

/**
 * Every error thrown by txat ; use `code` to tell them apart
 */
export class TxatError extends Error {
    constructor(
        public readonly code: TXAT_ERRORS,
        message: string
    ) {
        super(message);
        this.name = 'TxatError';
    }
}
