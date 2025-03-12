class User {
    constructor () {
        this._id = '';
        this._name = '';
    }

    /**
     * @returns {string}
     */
    get id () {
        return this._id;
    }
}

module.exports = User;
