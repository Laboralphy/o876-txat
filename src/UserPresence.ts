import { POWERS } from './powers';
import type { PresenceDto } from './events';

/**
 * Called when a power is actually granted or revoked
 */
export type PowerChangeListener = (presence: UserPresence, power: POWERS, granted: boolean) => void;

/**
 * A user presence is the capacity of a user on a channel
 * A user maybe admin on a channel and a simple reader on another channel
 * @class
 */
export class UserPresence {
    private readonly _powers = new Set<POWERS>();
    private _color: string = '';

    /**
     * Notified of every power change ; set by the channel owning this presence
     */
    public onPowerChange: PowerChangeListener | undefined;

    /**
     * @param id user id
     * @param name user display name (defaults to id)
     */
    constructor(
        public readonly id: string,
        public readonly name: string = id
    ) {}

    grant(power: POWERS) {
        if (!this._powers.has(power)) {
            this._powers.add(power);
            this.onPowerChange?.(this, power, true);
        }
        return this;
    }

    revoke(power: POWERS) {
        if (this._powers.delete(power)) {
            this.onPowerChange?.(this, power, false);
        }
        return this;
    }

    hasPower(power: POWERS) {
        return this._powers.has(power);
    }

    /**
     * Return the list of granted powers
     */
    get powers(): POWERS[] {
        return Array.from(this._powers);
    }

    get color() {
        return this._color;
    }

    set color(color: string) {
        this._color = color;
    }

    /**
     * Return a plain snapshot of this presence, safe to serialize
     */
    toJSON(): PresenceDto {
        return {
            id: this.id,
            name: this.name,
            color: this._color,
            powers: this.powers,
        };
    }
}
