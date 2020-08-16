/*
 * Copyright (c) 2018-2020 Frederic Rezeau, aka 오경진.
 * Copyright (c) 2018-2020 Litemint LLC.
 * This source code is licensed under the MIT license.
 * See the LICENSE file for more information.
 */

"use strict";

// Litemint config.
(function (namespace) {

    namespace.config = {
        "version": "1.3.1",
        "storageId": "1a442083-acd8-4ba7-9f0e-3c4e8d4a611k-0",
        "debug": false,
        "maxOperations": 100,
        "memoryStorageFallback": false,
        "marketDataInterval": 2,
        "disableAds": true,
        "defaultAssets": [
            { "code": "CREDIT", "issuer": "GBAKUWF2HTJ325PH6VATZQ3UNTK2AGTATR43U52WQCYJ25JNSCF5OFUN" },
            { "code": "BTC", "issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5" },
            { "code": "ETH", "issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5" },
            { "code": "LTC", "issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5" },
            { "code": "XRP", "issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5" },
            { "code": "GRIN", "issuer": "GCNR3JUD6XFNFZOPDK63EI57QYIOEJDLZMG24IR5KYSORCWRTPUBRWOM" },
            { "code": "USD", "issuer": "GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX" }
        ],
        "seamlessAssets": []
    };

})(window.Litemint = window.Litemint || {});
