const USER_RANKS_CAPABILITIES = require('./data/user-ranks-capabilities.json');

/**
 * @type {{[p: string]: {index: number, id: string, capabilities: Set<string>}}}
 */
const userRanks = Object
    .fromEntries(Object
        .entries(USER_RANKS_CAPABILITIES)
        .map(([key, { index, capabilities }]) => {
            return [
                key,
                {
                    index,
                    id: key,
                    capabilities: new Set(capabilities)
                }
            ];
        }));

module.exports = userRanks;
