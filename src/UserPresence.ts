import { POWERS } from './powers';
import type { PresenceDto } from './events';

/**
 * A user presence is the capacity of a user on a channel
 * A user maybe admin on a channel and a simple reader on another channel
 * @class
 */
export class UserPresence {
    private readonly _powers = new Set<POWERS>();
    private _color: string = '';

    constructor(public readonly id: string) {}

    grant(power: POWERS) {
        this._powers.add(power);
        return this;
    }

    revoke(power: POWERS) {
        this._powers.delete(power);
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
            color: this._color,
            powers: this.powers,
        };
    }
}
