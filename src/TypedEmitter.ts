export type Listener<T> = (payload: T) => void;

/**
 * Called when a listener throws, or when an async listener rejects
 */
export type ErrorHandler<M extends object> = (
    error: unknown,
    event: keyof M,
    payload: M[keyof M]
) => void;

export type TypedEmitterOptions<M extends object> = {
    onError?: ErrorHandler<M>;
};

const defaultErrorHandler = (error: unknown, event: PropertyKey): void => {
    console.error(`[txat] listener of event "${String(event)}" failed:`, error);
};

/**
 * Minimal, platform-agnostic event emitter, typed by an event map: { eventName: payloadType }
 * Listeners are called synchronously, in subscription order.
 * A failing listener never prevents the others from being called : its error is passed to
 * the error handler (console.error by default).
 */
export class TypedEmitter<M extends object> {
    private readonly listeners = new Map<keyof M, Set<Listener<never>>>();
    private readonly onceListeners = new Set<Listener<never>>();

    /**
     * Receives errors thrown by listeners (and rejections of async listeners)
     */
    public onError: ErrorHandler<M>;

    constructor({ onError = defaultErrorHandler }: TypedEmitterOptions<M> = {}) {
        this.onError = onError;
    }

    /**
     * Pass a listener error to the error handler, without ever throwing
     */
    private reportError<K extends keyof M>(error: unknown, event: K, payload: M[K]) {
        try {
            this.onError(error, event, payload);
        } catch (handlerError) {
            defaultErrorHandler(handlerError, event);
        }
    }

    /**
     * Subscribe a listener to an event
     * @param event event name
     * @param listener function called with event payload
     */
    on<K extends keyof M>(event: K, listener: Listener<M[K]>): this {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(listener);
        return this;
    }

    /**
     * Subscribe a listener that will be unsubscribed after its first call
     * @param event event name
     * @param listener function called with event payload
     */
    once<K extends keyof M>(event: K, listener: Listener<M[K]>): this {
        this.onceListeners.add(listener);
        return this.on(event, listener);
    }

    /**
     * Unsubscribe a listener
     * @param event event name
     * @param listener previously subscribed function
     */
    off<K extends keyof M>(event: K, listener: Listener<M[K]>): this {
        this.listeners.get(event)?.delete(listener);
        this.onceListeners.delete(listener);
        return this;
    }

    /**
     * Call every listener of an event ; never throws : listener errors go to the error handler
     * @param event event name
     * @param payload event payload
     * @return true if the event had listeners
     */
    emit<K extends keyof M>(event: K, payload: M[K]): boolean {
        const set = this.listeners.get(event);
        if (!set || set.size === 0) {
            return false;
        }
        for (const listener of Array.from(set) as Listener<M[K]>[]) {
            if (this.onceListeners.has(listener)) {
                this.off(event, listener);
            }
            try {
                const result: unknown = listener(payload);
                if (result instanceof Promise) {
                    result.catch((error: unknown) => this.reportError(error, event, payload));
                }
            } catch (error) {
                this.reportError(error, event, payload);
            }
        }
        return true;
    }

    /**
     * Return the number of listeners subscribed to an event
     * @param event event name
     */
    listenerCount<K extends keyof M>(event: K): number {
        return this.listeners.get(event)?.size ?? 0;
    }

    /**
     * Unsubscribe all listeners of an event, or of every event when none is specified
     * @param event event name
     */
    removeAllListeners<K extends keyof M>(event?: K): this {
        if (event === undefined) {
            this.listeners.clear();
            this.onceListeners.clear();
        } else {
            this.listeners.get(event)?.forEach((listener) => this.onceListeners.delete(listener));
            this.listeners.delete(event);
        }
        return this;
    }
}
