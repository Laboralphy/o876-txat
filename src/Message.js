class Message {
    constructor (content, sender) {
        this._content = '';
        this._sender = null;
        this._timestamp = Date.now();
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
