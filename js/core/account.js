/**
 * @overview Litemint Core Account implementation.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {

    // According to BIP44 initial path and SLIP-0044.
    // Full hardened derivation.
    const masterKeyPath = "m/44'/148'/0'";

    // https://www.stellar.org/developers/guides/concepts/fees.html#transaction-fee
    // The base fee(currently 100 stroops) is used in transaction fees
    // The base reserve(currently 0.5 XLM) is used in minimum account
    const stroop = 0.0000001;
    const baseFee = 100 * stroop;
    const baseReserve = 0.5;

    // Mnemonic language.
    const language = "english";

    // Account prefix for unique ids.
    const accountPrefix = "fbfe7469-1c67-4c38-ba93-f493f4099359";

    /**
     * Represents an account.
     * @class Account
     * @memberof Litemint.Core
     */
    namespace.Core.Account = function () {
        if (!(this instanceof namespace.Core.Account)) {
            throw new Error("ctor error");
        }

        // List of operations for this account.
        this.operations = [];

        // List of assets for this account.
        this.assets = [];

        // List of offers for this account.
        this.offers = [];

        // List of addresses for this account.
        this.addresses = [];

        // List of notifications.
        this.notifications = [];

        // This account friendly address.
        this.friendlyAddress = null;
    };

    // Create a new account.
    namespace.Core.Account.prototype.create = function (pin, name, detached, serializer, data) {
        const account = {
            "id": accountPrefix + namespace.Core.Utils.bytesToHex(namespace.Core.Utils.getRandomBytes(16)),
            "name": name,
            "filters": [true, false, false, true, true, true, true, false],
            "currency": "USD",
            "nonotif": false,
            "notoast": false
        };

        // Save the mnemonic to the vault.
        const vault = new namespace.Core.Vault(account.id, namespace.Core.Utils.bytesToHex(pin));
        const keyTool = new namespace.Core.KeyTool(language);

        if (!data) {
            const mnemonic = keyTool.createMnemonic();
            vault.setData(namespace.Core.Utils.pad16(mnemonic));
        }
        else {
            vault.setData(namespace.Core.Utils.pad16(data));
        }

        // Account serializer.
        if (serializer) {
            const data = serializer.load();
            data.lastaccount = data.accounts.length;
            data.accounts.push(account);
            serializer.save(data);
        }

        // Load if not detached mode.
        if (!detached) {
            this.load(pin, serializer);
        }
    };

    // Retrieve the public key from mnemonic.
    namespace.Core.Account.prototype.getPublicFromMnemonic = function (mnemonic) {
        const keyTool = new namespace.Core.KeyTool(language);
        const split = keyTool.splitWords(mnemonic);
        if (split.length === 24) {
            const seed = keyTool.mnemonicToSeed(mnemonic);
            const derivation = keyTool.deriveChildKey(masterKeyPath, keyTool.generateMasterKey(seed));
            return keyTool.generateKey(derivation).publicKey();
        }
        return null;
    };

    // Retrieve the public key from secret.
    namespace.Core.Account.prototype.getPublicFromSecret = function (secret) {
        const keyTool = new namespace.Core.KeyTool(language);
        return keyTool.importKey(secret).publicKey();
    };

    // Load the account.
    // Including on-the-fly master key derivation.
    namespace.Core.Account.prototype.load = function (pin, serializer) {
        const keyTool = new namespace.Core.KeyTool(language);
        const data = serializer.load();
        const account = data.accounts[data.lastaccount];

        if (account) {
            const vault = new namespace.Core.Vault(account.id, namespace.Core.Utils.bytesToHex(pin));
            const mnemonic = namespace.Core.Utils.unpad16(vault.getData());
            const split = keyTool.splitWords(mnemonic);

            if (split.length === 24) {
                // Import from mnemonic.
                const seed = keyTool.mnemonicToSeed(mnemonic);
                const derivation = keyTool.deriveChildKey(masterKeyPath, keyTool.generateMasterKey(seed));
                this.keys = keyTool.generateKey(derivation);
                this.mnemonic = split;
                if (namespace.config.testAccounts &&
                    namespace.config.testAccounts.length &&
                    namespace.config.testAccountIndex >= 0) {
                    this.keys = keyTool.importKey(
                        namespace.config.testAccounts[namespace.config.testAccountIndex]);
                }

                this.watchOnly = false;
                this.nobackup = false;

                namespace.Core.Account.ResolveAccount(this.keys.publicKey(), "litemint.com", (addr) => {
                    this.friendlyAddress = addr;
                });
                return true;
            }
            else if (StellarSdk.StrKey.isValidEd25519PublicKey(mnemonic)) {
                // Import a watch only account.
                this.watchOnly = true;
                this.nobackup = true;
                this.keys = {
                    "publicKey": function () { return mnemonic; },
                    "secret": function () { return ""; }
                };

                namespace.Core.Account.ResolveAccount(this.keys.publicKey(), "litemint.com", (addr) => {
                    this.friendlyAddress = addr;
                });
                return true;
            }
            else if (StellarSdk.StrKey.isValidEd25519SecretSeed(mnemonic)) {
                // Import from secret key.
                this.watchOnly = false;
                this.nobackup = true;
                this.keys = keyTool.importKey(mnemonic);

                namespace.Core.Account.ResolveAccount(this.keys.publicKey(), "litemint.com", (addr) => {
                    this.friendlyAddress = addr;
                });
                return true;
            }
        }
        return false;
    };

    // Unload the account.
    namespace.Core.Account.prototype.unload = function (cb) {
        delete this.keys;
        delete this.mnemonic;
        delete this.watchOnly;

        if (cb) {
            cb();
        }
    };

    // Get the account reserve.
    namespace.Core.Account.prototype.getReserve = function (asset) {
        if (this.data) {
            let reserve = asset.issuer === "native" ? (2 + this.data.subentry_count) * baseReserve : 0;
            this.offers.forEach(function (x) {
                reserve += x.baseAsset.code === asset.code && (x.baseAsset.issuer === asset.issuer || asset.issuer === "native" && !x.baseAsset.issuer) ? Number(x.baseAmount) : 0;
            });
            return asset.issuer === "native" ? reserve + this.data.subentry_count * baseFee : reserve;
        }
        else {
            return 0;
        }
    };

    // Get the maximum amount available.
    namespace.Core.Account.prototype.getMaxSend = function (balance, asset) {
        if (this.data) {
            return asset.issuer === "native" ? Math.max(0, balance - this.getReserve(asset) - baseFee) : Math.max(0, balance - this.getReserve(asset));
        }
        else {
            return balance;
        }
    };

    // Get the base fee.
    namespace.Core.Account.prototype.getBaseFee = function () {
        return baseFee;
    };

    // Get the trust base fee.
    namespace.Core.Account.prototype.getTrustBaseFee = function () {
        return baseFee + baseReserve;
    };

    // Is the account loaded.
    namespace.Core.Account.prototype.isLoaded = function () {
        return this.keys ? true : false;
    };

    /**
     * Resolve a Stellar account id.
     * @static
     * @member ResolveAccount
     * @param {String} data Account Id to resolve.
     * @param {String} domain Domain to resolve from.
     * @param {Function} cb callback.
     * @memberof Litemint.Core.Account
     */
    namespace.Core.Account.ResolveAccount = function (data, domain, cb) {
        StellarSdk.FederationServer.createForDomain(domain)
            .then((federationServer) => {
                federationServer.resolveAccountId(data)
                    .then((federationRecord) => {
                        if (federationRecord.stellar_address) {
                            cb(federationRecord.stellar_address);
                        }
                    });
            });
    };

    /**
     * Resolve an address.
     * @static
     * @member ResolveAddress
     * @param {String} address Address to resolve.
     * @param {Function} cb callback.
     * @memberof Litemint.Core.Account
     */
    namespace.Core.Account.ResolveAddress = function (address, cb) {
        if (-1 === address.indexOf("*")) {
            cb();
        }
        else {
            StellarSdk.FederationServer.resolve(address)
                .then(federationRecord => {
                    cb(federationRecord.account_id, federationRecord.memo, federationRecord.memo_type);
                })
                .catch(() => {
                    cb();
                });
        }
    };

    /**
     * The current user account (instance of Litemint.Core.Account).
     * @member currentAccount
     * @memberof Litemint.Core
     */
    namespace.Core.currentAccount = new namespace.Core.Account();

})(window.Litemint = window.Litemint || {});
