const REGEX_INT_STR = /^(\d+)\s*([a-zA-Z]+)$/;

class Ban {
    constructor (user, reason) {
        this._user = user;
        this._reason = reason;
        this._until = null;
        this._permanent = false;
        this._dateProvider = null;
        this._banner = null;
    }

    inject ({ dateProvider }) {
        this._dateProvider = dateProvider;
    }

    set banner (banner) {
        this._banner = banner;
    }

    get banner () {
        return this._banner;
    }

    /**
     * @typedef TxatBanState {object}
     * @property user {string}
     * @property banner {string}
     * @property permanent {boolean}
     * @property reason {string}
     * @property until {number}
     *
     * @returns {TxatBanState}
     */
    get state () {
        return {
            user: this._user.id,
            banner: this._banner.id,
            permanent: this._permanent,
            reason: this._reason,
            until: this._until.getTime()
        };
    }

    /**
     * @returns {IDateProvider}
     */
    get dateProvider () {
        if (!this._dateProvider) {
            throw new Error('Date provider not injected');
        }
        return this._dateProvider;
    }

    get user () {
        return this._user;
    }

    set permanent (value) {
        this._permanent = value;
    }

    get permanent () {
        return this._permanent;
    }

    set until (date) {
        if (!(date instanceof Date)) {
            throw new TypeError('Ban date must be instance of Date');
        }
        this._until = date;
        this._permanent = false;
    }

    get until () {
        return this._until;
    }

    set reason (reason) {
        this._reason = reason;
    }

    get reason () {
        return this._reason;
    }

    /**
     * Ajoute du temps à un objet Date.
     * @param date {Date} L'objet Date de départ.
     * @param [seconds=0] {number} Le nombre de secondes à ajouter.
     * @param [minutes=0] {number} Le nombre de minutes à ajouter.
     * @param [hours=0] {number} Le nombre d'heures à ajouter.
     * @param [days=0] {number} Le nombre de jours à ajouter.
     * @returns {Date} L'objet Date mis à jour.
     */
    _addTimeToDate(date, seconds = 0, minutes = 0, hours = 0, days = 0) {
        return this._dateProvider.add(date, { seconds, minutes, hours, days });
    }

    setDurationString (s, dFrom) {
        const r = s.match(REGEX_INT_STR);
        if (r) {
            this.setDuration(parseInt(r[1]), r[2], dFrom);
        } else {
            throw new TypeError(`could not parse this duration : ${s}`);
        }
    }

    setDuration (n, sUnit, dFrom) {
        if (!(dFrom instanceof Date)) {
            throw new TypeError('third parameter must be instance od Date');
        }
        switch (sUnit) {
        case 's':
        case 'sec':
        case 'secs':
        case 'second':
        case 'seconds': {
            this.until = this._addTimeToDate(dFrom, n);
            break;
        }

        case 'min':
        case 'mins':
        case 'minute':
        case 'minutes': {
            this.until = this._addTimeToDate(dFrom, 0, n);
            break;
        }

        case 'h':
        case 'hr':
        case 'hrs':
        case 'hour':
        case 'hours': {
            this.until = this._addTimeToDate(dFrom, 0, 0, n);
            break;
        }

        case 'd':
        case 'day':
        case 'days': {
            this.until = this._addTimeToDate(dFrom, 0, 0, 0, n);
            break;
        }

        default: {
            throw new Error('unit not valid');
        }
        }
    }

    /**
     *
     * @param sDate {string} format YYYY-MM-DD [HH:MM:SS]
     */
    setUnbanDate (sDate) {
        this.until = this._dateProvider.parse(sDate);
    }

    get active () {
        const d = this._dateProvider.now();
        return this._permanent || this.until.getTime() >= d.getTime();
    }
}

module.exports = Ban;
