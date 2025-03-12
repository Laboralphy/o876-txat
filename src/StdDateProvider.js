const IDateProvider = require('./IDateProvider');

class StdDateProvider extends IDateProvider {
    /**
     * @returns {Date}
     */
    now () {
        return new Date();
    }
}

module.exports = StdDateProvider;
