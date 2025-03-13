const IDateProvider = require('./IDateProvider');

const REGEX_YMD = /^(\d{4})[-\/]+(\d{2})[-\/]+(\d{2})$/;
const REGEX_YMDHM = /^(\d{4})[-\/]+(\d{2})[-\/]+(\d{2})\s+(\d{2}):+(\d{2})$/;
const REGEX_YMDHMS = /^(\d{4})[-\/]+(\d{2})[-\/]+(\d{2})\s+(\d{2}):+(\d{2}):+(\d{2})$/;

/**
 * This provider use internal clock to provide current date/time
 */
class StdDateProvider extends IDateProvider {
    /**
     * @returns {Date}
     */
    now () {
        return new Date();
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
    add(date, { seconds = 0, minutes = 0, hours = 0, days = 0 }) {
        // Convertir les minutes, heures et jours en millisecondes
        const totalMilliseconds = (seconds * 1000) + (minutes * 60 * 1000) + (hours * 60 * 60 * 1000) + (days * 24 * 60 * 60 * 1000);
        // Créer un nouvel objet Date basé sur l'objet Date d'origine
        return new Date(date.getTime() + totalMilliseconds);
    }

    /**
     * Gets a new Date from the specified string
     * @example parse('2022-10-15'); parse('2022-10-15 23:58'); parse('2022-10-15 23:58:37')
     * @param sDate
     * @returns {Date}
     */
    parse (sDate) {
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
}

module.exports = StdDateProvider;
