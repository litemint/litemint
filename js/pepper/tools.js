/**
 * @overview Litemint Pepper Tools implementation.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

(function (namespace) {
    "use strict";

    /**
     * Calculate the distance between two points.
     * @function distance
     * @memberof Litemint.Pepper.Tools
     * @param {Number} x1 First point x coordinate.
     * @param {Number} y1 First point y coordinate.
     * @param {Number} x2 Second point x coordinate.
     * @param {Number} y2 Second point y coordinate.
     * @return {Number} Distance.
     */
    namespace.Pepper.Tools.distance = function (x1, y1, x2, y2) {
        const xd = x2 - x1;
        const yd = y2 - y1;
        return Math.sqrt(xd * xd + yd * yd);
    };

    /**
     * Check whether the point is within the rect.
     * @function pointInRect
     * @memberof Litemint.Pepper.Tools
     * @param {Number} x Point x coordinate.
     * @param {Number} y Point y coordinate.
     * @param {Number} l Left coordinate.
     * @param {Number} t Top coordinate.
     * @param {Number} r Right coordinate.
     * @param {Number} b Bottom coordinate.
     * @return {Boolean} True or False.
     */
    namespace.Pepper.Tools.pointInRect = function (x, y, l, t, r, b) {
        return x > l && x < r && y > t && y < b;
    };

    /**
     * Preload resources with callback.
     * @function loadResources
     * @memberof Litemint.Pepper.Tools
     * @param {Array} manifest Manifest of resources to load.
     * @param {Function} cb Callback after completion.
     * @param {Function} singlecb Callback for progress.
     */
    namespace.Pepper.Tools.loadResources = function (manifest, cb, singlecb) {
        const len = manifest.length;
        let resources = {},
            loadedResources = 0;
        function onLoad() {
            if (++loadedResources === len && cb) {
                cb(resources);
            }
            if (singlecb) {
                singlecb(loadedResources, len);
            }
        }
        for (let i = 0; i < len; i += 1) {
            let item = manifest[i];
            resources[item.id] = new Image();
            resources[item.id].onload = onLoad;
            resources[item.id].src = item.src;
        }
    };

    /**
     * Format the price for display.
     * @function formatPrice
     * @memberof Litemint.Pepper.Tools
     * @param {String} price Price to format.
     * @param {Number} decimals Decimals to display.
     * @return {String} Formatted price.
     */
    namespace.Pepper.Tools.formatPrice = function (price, decimals) {
        const num = Number(!isNaN(price) ? price : "0");
        return decimals ? num.toFixed(decimals) : num.toFixed(7);
    };

    /**
     * Convert rational price number to decimal.
     * @function rationalPriceToDecimal
     * @memberof Litemint.Pepper.Tools
     * @param {Object} price Price to convert.
     * @return {Number} Decimal price.
     */
    namespace.Pepper.Tools.rationalPriceToDecimal = function (price) {
        return price.n / price.d;
    };

    /**
     * Provide friendly relative time.
     * @function friendlyTime
     * @memberof Litemint.Pepper.Tools
     * @param {Number} current Current time.
     * @param {Number} previous Previous time.
     * @return {Object} Friendly time object.
     */
    namespace.Pepper.Tools.friendlyTime = function (current, previous) {
        const min = 60 * 1000;
        const elapsed = current - previous;
        const res = {
            "friendly": namespace.Pepper.Resources.localeText[61],
            "short": true
        };
        if (elapsed < min) {
            res.friendly = namespace.Pepper.Resources.localeText[61];
        }
        else if (elapsed < min * 60) {
            let count = Math.round(elapsed / min);
            res.friendly = count + (count < 2 ?
                " " + namespace.Pepper.Resources.localeText[59] :
                " " + namespace.Pepper.Resources.localeText[60]);
        }
        else {
            res.friendly = new Date(previous).toLocaleString();
            res.short = false;
        }
        return res;
    };

    /**
     * Truncate a key for display.
     * @function truncateKey
     * @memberof Litemint.Pepper.Tools
     * @param {String} key Key to truncate.
     * @return {String} Truncated key.
     */
    namespace.Pepper.Tools.truncateKey = function (key, long) {
        if (key.length > 25) {
            if (long) {
                return key.substr(0, 10) + "..." + key.substr(key.length - 10, key.length);
            }
            else {
                return key.substr(0, 7) + "..." + key.substr(key.length - 7, key.length);
            }
        }
        return key;
    };

    // requestAnimationFrame polyfill. @author paulirish / http://paulirish.com/
    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = (function () {
            return window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
                function (callback) {
                    window.setTimeout(callback, 1000 / 60);
                };
        })();
    }

})(window.Litemint = window.Litemint || {});
