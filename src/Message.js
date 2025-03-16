const User = require('./User');

class Message {
    /**
     * @param content {string}
     * @param sender {User}
     * @param timestamp {number}
     */
    constructor (content, sender, timestamp = 0) {
        this._content = '';
        this._sender = sender;
        this._timestamp = timestamp;
        this._content = content;
    }

    get content() {
        return this._content;
    }

    get sender () {
        return this._sender;
    }
}

module.exports = Message;
