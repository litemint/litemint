/*
 * Copyright (c) 2018-2026 Frederic Rezeau, aka 오경진.
 * Copyright (c) 2018-2026 Litemint LLC.
 * This source code is licensed under the MIT license.
 * See the LICENSE file for more information.
 */

"use strict";

// Litemint config.
(function (namespace) {

    namespace.config = {
        "version": "1.4.0",
        "storageId": "1a442083-acd8-4ba7-9f0e-3c4e8d4a611k-0",
        "debug": false,
        "maxOperations": 100,
        "memoryStorageFallback": false,
        "marketDataInterval": 2,
        "disableAds": true,
        "defaultAssets": [
            { "code": "CREDIT", "issuer": "GBAKUWF2HTJ325PH6VATZQ3UNTK2AGTATR43U52WQCYJ25JNSCF5OFUN" },
            { "code": "XBID", "issuer": "GAWUKSYHK4ORD6YTC6366CQQNVNVGBDDJKRRQOG3NUZMMAGSM547XBID" },
            { "code": "KALE", "issuer": "GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE" }
        ],
        "seamlessAssets": []
    };

})(window.Litemint = window.Litemint || {});
