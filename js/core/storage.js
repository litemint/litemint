/**
 * @overview Litemint Core Storage implementation.
 * @copyright 2018-2020 Frederic Rezeau, aka 오경진.
 * @copyright 2018-2020 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {

    // Initialization vector for AES Cipher Block Chaining (CBC) mode.
    const iv = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    // Suffix for the salt storage id (PBKDF2).
    const saltSuffix = "-salt";

    // Hash primitives from elliptic.
    const hashUtils = elliptic.utils.hash;

    // Is the local storage API available?
    const hasStorage = typeof window.localStorage !== "undefined";

    /**
     * Memory Storage fallback if enabled (see Litemint.config.memoryStorageFallback).
     * @member memoryStorage
     * @memberof Litemint.Core
     */
    const memoryStorage = {
        "map": {},
        "setItem": function (key, value) {
            return this.map[key] = value;
        },
        "getItem": function (key) {
            return this.map.hasOwnProperty(key) ? this.map[key] : null;
        }
    };

    /**
     * Get data iff local storage is available.
     * @function getData
     * @param {String} location Location.
     * @memberof Litemint.Core
     * @return {Object} Data Object.
     */
    namespace.Core.getData = function (location) {
        if (hasStorage) {
            return window.localStorage.getItem(location);
        }
        else if (namespace.config.memoryStorageFallback) {
            return memoryStorage.getItem(location);
        }
    };

    /**
     * Set data iff local storage is available.
     * @function setData
     * @param {String} location Location.
     * @param {Object} data object to save.
     * @memberof Litemint.Core
     */
    namespace.Core.setData = function (location, data) {
        if (hasStorage) {
            window.localStorage.setItem(location, data);
        }
        else if (namespace.config.memoryStorageFallback) {
            memoryStorage.setItem(location, data);
        }
    };

    /**
     * Represents a Secure Data Vault.
     * @class Vault
     * @param {String} location Storage location for this vault.
     * @param {Array} pin Pin number to use on the vault.
     * @param {Number} [timeout] Timeout till auto-close.
     * @memberof Litemint.Core
     */
    namespace.Core.Vault = function (location, pin, timeout) {
        if (!(this instanceof namespace.Core.Vault)) {
            throw new Error("ctor error");
        }

        // KeyTool instance.
        const keyTool = new namespace.Core.KeyTool();

        // The vault storage location.
        this.location = location;

        // A cryptographically random salt is generated
        // per location.
        this.salt = namespace.Core.getData(this.location + saltSuffix);
        if (!this.salt) {
            this.salt = namespace.Core.Utils.bytesToHex(namespace.Core.Utils.getRandomBytes(16));
            namespace.Core.setData(this.location + saltSuffix, this.salt);
        }

        // Derive the key from pin (PBKDF2).
        this.key = hashUtils.sha256()
            .update(keyTool.keyFromPin(pin, this.salt))
            .digest();

        // Lock the vault after timeout has elapsed.
        if (timeout && !isNaN(timeout)) {
            setTimeout(() => {
                delete this.key;
            }, timeout);
        }
    };

    // Retrieve the data from the vault encrypted storage.
    namespace.Core.Vault.prototype.getData = function () {
        if (!this.key) {
            throw new Error("Vault is locked");
        }
        // Using AES w/ CBC mode for portability.
        const aes = new aesjs.ModeOfOperation.cbc(this.key, iv);
        let data = namespace.Core.getData(this.location);
        if (data) {
            data = aes.decrypt(namespace.Core.Utils.hexToBytes(data));
        }
        return data;
    };

    // Set the data to the vault encrypted storage.
    namespace.Core.Vault.prototype.setData = function (data) {
        if (!this.key) {
            throw new Error("Vault is locked");
        }

        if (data) {
            // Using AES w/ CBC mode for portability.
            const aes = new aesjs.ModeOfOperation.cbc(this.key, iv);
            namespace.Core.setData(this.location, namespace.Core.Utils.bytesToHex(aes.encrypt(data)));
        }
    };

})(window.Litemint = window.Litemint || {});
