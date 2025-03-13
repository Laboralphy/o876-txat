/**
 * This is an interface.
 * This interface will provide a function now() that produce a Date instance
 * This is usefull when unit testing as you can easily mock now().
 *
 * Most of the time you will use StdDateProvider to get your new Date
 * But because I fear of having "new Date()" everywhere in my code, I prefer using provider injection.
 */
class IDateProvider {
    /**
     * @return {Date}
     */
    now () {
        throw new Error('ERR_NOT_IMPLEMENTED');
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
        throw new Error('ERR_NOT_IMPLEMENTED');
    }

    /**
     *
     * @param sDate {string}
     * @return {Date}
     */
    parse (sDate) {
        throw new Error('ERR_NOT_IMPLEMENTED');
    }

}

module.exports = IDateProvider;
