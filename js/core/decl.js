/**
 * @overview Litemint decl.
 * @copyright 2018-2020 Frederic Rezeau, aka 오경진.
 * @copyright 2018-2020 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

/**
 * Litemint namespace.
 * @namespace Litemint
 */
(function (namespace) {

    /**
     * Litemint.Core namespace.
     * @namespace Litemint.Core
     * @memberof Litemint
     */
    namespace.Core = {};

    /**
     * Litemint.Core.Utils namespace.
     * @namespace Litemint.Core.Utils
     * @memberof Litemint.Core
     */
    namespace.Core.Utils = {};

    // Default configuration.
    namespace.config = namespace.config || {};
    namespace.config.version = namespace.config.version || "1.0.0";
    namespace.config.storageId = namespace.config.storageId || "1a442083-acd8-4ba7-9f0e-3c4e8d4a611k-1";
    namespace.config.debug = typeof namespace.config.debug === "undefined" ? true : namespace.config.debug;
    namespace.config.serverUrl = namespace.config.serverUrl || "https://horizon.stellar.org";
    namespace.config.apiUrl = namespace.config.apiUrl || "https://api.litemint.com";
    namespace.config.federationServer = namespace.config.federationServer || "https://api.litemint.com/federation";
    namespace.config.opsEndPoint = namespace.config.opsEndPoint || "https://app.litemint.com/operations?opid=";
    namespace.config.maxOperations = namespace.config.maxOperations || 100;
    namespace.config.maxOrders = namespace.config.maxOrders || 50;
    namespace.config.marketDataInterval = namespace.config.marketDataInterval ? namespace.config.marketDataInterval : 2;
    namespace.config.memoryStorageFallback = typeof namespace.config.memoryStorageFallback === "undefined" ? false : namespace.config.memoryStorageFallback;
    namespace.config.defaultAssets = namespace.config.defaultAssets || [{ "code": "MAG", "issuer": "GDXP3TDM2D3VRRMGVFI6OFZDJQRP63MJ6C4PNJJBZR7GKGZE7ZGQIRKF" }];
    namespace.config.seamlessAssets = namespace.config.seamlessAssets || [];
    if (!namespace.config.debug) {
        console.log = function () { };
    }

})(window.Litemint = window.Litemint || {});
