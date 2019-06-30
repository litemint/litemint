/**
 * @overview Litemint Pepper decl.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {

    /**
     * Litemint.Pepper namespace.
     * @namespace Litemint.Pepper
     * @memberof Litemint
     */
    namespace.Pepper = {
        /**
         * PageType
         * @member PageType
         * @memberof Litemint.Pepper
        */
        "PageType": {
            "SignIn": 0,
            "SignUp": 1,
            "Dashboard": 2
        },

        /**
         * ScrollerType
         * @member ScrollerType
         * @memberof Litemint.Pepper
        */
        "ScrollerType": {
            "Languages": 0,
            "Accounts": 1,
            "Assets": 2,
            "AssetsMenu": 3,
            "FilterMenu": 4,
            "AddAsset": 5,
            "AccountSettings": 6,
            "Currencies": 7,
            "Addresses": 8,
            "QuotesMenu": 9,
            "LastTrades": 10,
            "LiveOrders": 11,
            "Leaderboard": 12,
            "ShopMenu": 13,
            "ShopConfirm": 14
        },

        /**
         * ActivityType
         * @member ActivityType
         * @memberof Litemint.Pepper
        */
        "ActivityType": {
            "SelectSendAmount": 0,
            "SelectSendRecipient": 1,
            "ConfirmSend": 2,
            "DisplaySendSummary": 3,
            "Receive": 5,
            "Trade": 6,
            "Exchange": 7
        },

        /**
         * ListType
         * @member ListType
         * @memberof Litemint.Pepper
        */
        "ListType": {
            "Transactions": 0,
            "Assets": 1
        },

        /**
         * FilterType
         * @member FilterType
         * @memberof Litemint.Pepper
        */
        "FilterType": {
            "Verified": 0,
            "Trusted": 1,
            "WithBalance": 2,
            "PaymentReceived" : 3,
            "PaymentSent" : 4,
            "Trades": 5,
            "Trust": 6,
            "Other": 7
        },

        /**
         * FilterType
         * @member FilterType
         * @memberof Litemint.Pepper
        */
        "ViewErrorType": {
            "None": 0,
            "AccountNotCreated": 1,
            "AccountNotAvailable": 2
        },

        /**
         * WizardType
         * @member WizardType
         * @memberof Litemint.Pepper
        */
        "WizardType": {
            "None": 0,
            "BackupStep1": 1,
            "BackupStep2": 2,
            "BackupStep3": 3,
            "ViewAsset": 4,
            "ImportAccount": 5
        }
    };

    /**
     * Litemint.Pepper.Resources namespace.
     * @namespace Litemint.Pepper.Resources
     * @memberof Litemint.Pepper
     */
    namespace.Pepper.Resources = {};

    /**
    * Litemint.Pepper.MarketData namespace.
    * @namespace Litemint.Pepper.MarketData
    * @memberof Litemint.Pepper
    */
    namespace.Pepper.MarketData = {};

    /**
     * Litemint.Pepper.Tools namespace.
     * @namespace Litemint.Pepper.Tools
     * @memberof Litemint.Pepper
     */
    namespace.Pepper.Tools = {};

    /**
    * Litemint.Pepper.cachedMarketData.
    * @member Litemint.Pepper.cachedMarketData
    * @memberof Litemint.Pepper
    */
    namespace.Pepper.cachedMarketData = {};

    /**
     * Load the wallet data if the local storage is available
     * otherwise return default data.
     * @function loadWalletData
     * @return {Object} data object to load.
     * @memberof Litemint.Pepper
     */
    namespace.Pepper.loadWalletData = function () {
        let data = {
            "languageId": "en",
            "accounts": [],
            "lastaccount": -1
        };

        let currData = namespace.Core.getData(namespace.config.storageId);
        if (currData) {
            data = JSON.parse(currData);
        }
        return data;
    };

    /**
     * Save the wallet data iff local storage is available.
     * @function saveWalletData
     * @param {Object} data object to save.
     * @memberof Litemint.Pepper
     */
    namespace.Pepper.saveWalletData = function (data) {
        namespace.Core.setData(namespace.config.storageId, JSON.stringify(data));
    };

})(window.Litemint = window.Litemint|| {});
