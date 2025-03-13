const Events = require('node:events');
const EVENT_TYPES = require('./data/event-types.json');

class User {
    constructor () {
        this._id = '';
        this._name = '';
        this._ignoreList = new Set();
        this._events = new Events();
        this._connected = false;
    }

    get connected () {
        return this._connected;
    }

    set connected (value) {
        this._connected = value;
    }

    get event () {
        return this._events;
    }

    isIgnoring (user) {
        return this._ignoreList.has(user);
    }

    addIgnore (user) {
        this._ignoreList.add(user);
    }

    removeIgnore (user) {
        this._ignoreList.delete(user);
    }

    getIgnoredUsers () {
        return this._ignoreList;
    }

    receivePrivateMessage (message) {
        if (this._ignoreList.has(message.sender)) {
            return false;
        }
        this._events.emit(EVENT_TYPES.EVENT_USER_RECEIVE_PRIVATE_MESSAGE, { message });
    }

    /**
     * @returns {string}
     */
    get id () {
        return this._id;
    }

    get state () {
        return {
            id: this._id,
            name: this._name,
            ignoreList: [...this._ignoreList].map(u => u.id)
        };
    }
}

module.exports = User;
