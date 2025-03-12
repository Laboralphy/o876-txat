const CAPABILITIES = require('./data/capabilities.json');

class Power {
    constructor () {
        this._capabilities = new Set();
    }

    checkCapability (capability) {
        if (!(capability in CAPABILITIES)) {
            throw new TypeError('unknown capability : ' + capability);
        }
    }

    addCapability (capability) {
        this.checkCapability(capability);
        this._capabilities.add(capability);
    }

    removeCapability (capability) {
        this.checkCapability(capability);
        this._capabilities.delete(capability);
    }

    hasCapability (capability) {
        this.checkCapability(capability);
        return this._capabilities.has(capability);
    }
}

module.exports = Power;
