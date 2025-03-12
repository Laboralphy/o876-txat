const REGEX_YMD = /^(\d{4})[-\/]+(\d{2})[-\/]+(\d{2})$/;
const REGEX_YMDHM = /^(\d{4})[-\/]+(\d{2})[-\/]+(\d{2})\s+(\d{2}):+(\d{2})$/;
const REGEX_YMDHMS = /^(\d{4})[-\/]+(\d{2})[-\/]+(\d{2})\s+(\d{2}):+(\d{2}):+(\d{2})$/;
const REGEX_INT_STR = /^(\d+)\s*([a-zA-Z]+)$/;

class Banishment {
    constructor (user, reason) {
        this._user = user;
        this._reason = reason;
        this._until = null;
        this._permanent = false;
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
            throw new TypeError('Banishment date must be instance od Date');
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
        // Convertir les minutes, heures et jours en millisecondes
        const totalMilliseconds = (seconds * 1000) + (minutes * 60 * 1000) + (hours * 60 * 60 * 1000) + (days * 24 * 60 * 60 * 1000);
        // Créer un nouvel objet Date basé sur l'objet Date d'origine
        return new Date(date.getTime() + totalMilliseconds);
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

    _parseDate (sDate) {
        let r;
        r = sDate.match(REGEX_YMDHMS);
        if (r) {
            return new Date(
                parseInt(r[1]),
                parseInt(r[2]) - 1,
                parseInt(r[3]),
                parseInt(r[4]),
                parseInt(r[5]),
                parseInt(r[6])
            );
        }
        r = sDate.match(REGEX_YMDHM);
        if (r) {
            return new Date(
                parseInt(r[1]),
                parseInt(r[2]) - 1,
                parseInt(r[3]),
                parseInt(r[4]),
                parseInt(r[5]),
                0
            );
        }
        r = sDate.match(REGEX_YMD);
        if (r) {
            return new Date(
                parseInt(r[1]),
                parseInt(r[2]) - 1,
                parseInt(r[3]),
                0,
                0,
                0
            );
        }
        throw new TypeError(`could not parse input date ${sDate}`);
    }

    /**
     *
     * @param sDate {string} format YYYY-MM-DD [HH:MM:SS]
     */
    setUnbanDate (sDate) {
        this.until = this._parseDate(sDate);
    }

    isActive (d = null) {
        if (d === null) {
            d = new Date();
        }
        return this._permanent || this.until.getTime() >= d.getTime();
    }
}

module.exports = Banishment;
