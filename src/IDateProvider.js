class IDateProvider {
    now () {
        throw new Error('ERR_NOT_IMPLEMENTED');
    }
}

module.exports = IDateProvider;
