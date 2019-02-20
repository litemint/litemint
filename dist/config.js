/*
 * Copyright (c) 2018-2019 Frederic Rezeau.
 * Copyright (c) 2018-2019 Litemint LLC.
 * This source code is licensed under the MIT license.
 * See the LICENSE file for more information.
 */

"use strict";

// Litemint config.
(function (namespace) {

    namespace.config = {
        "version": "1.1.2",
        "storageId": "1a442083-acd8-4ba7-9f0e-3c4e8d4a611k-0",
        "debug": false,
        "maxOperations": 100,
        "memoryStorageFallback": false,
        "useNetworkPolling": true,
        "marketDataInterval": 2,
        "defaultAssets": [
            { "code": "MAG", "issuer": "GAACROE4I6LRXKDKAJ4PKGQHRAU43ZDKRBBSNCVYW5TXBP4RAWO62JAH" },
            { "code": "BTC", "issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5" },
            { "code": "GRIN", "issuer": "GCNR3JUD6XFNFZOPDK63EI57QYIOEJDLZMG24IR5KYSORCWRTPUBRWOM" },
            { "code": "XRP", "issuer": "GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5" },
            { "code": "USD", "issuer": "GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK" },
            { "code": "EURT", "issuer": "GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S" }
        ],
        "seamlessAssets": [
            {
                "code": "MAG",
                "issuer": "GAACROE4I6LRXKDKAJ4PKGQHRAU43ZDKRBBSNCVYW5TXBP4RAWO62JAH",
                "account": "GAIY5XSWTSVFBIOECL5D4QS3LXFFH2QLKOLSICGB4ETRH5L6QKHRTEHR",
                "deposit": "https://api.litemint.com/.magnet/deposit",
                "widthdraw": "https://api.litemint.com/.magnet/withdraw",
                "networkPrefix": 0x26
            }
        ]
    };

})(window.Litemint = window.Litemint || {});
