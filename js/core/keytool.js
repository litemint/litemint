/**
 * @overview Litemint Core KeyTool implementation.
 * @copyright 2018-2020 Frederic Rezeau, aka 오경진.
 * @copyright 2018-2020 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {

    // References.
    // SLIP-0010 - Universal private key derivation from master private key
    // https://github.com/satoshilabs/slips/blob/master/slip-0010.md
    // SEP-0005 - Key Derivation Methods for Stellar Accounts
    // https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md
    // BIP-39 - Mnemonic code for generating deterministic keys
    // https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki

    // Key for HMAC-SHA512 in Master key generation.
    const ed25519Key = "656432353531392073656564"; // "ed25519 seed"

    // Hash primitives from elliptic.
    const hashUtils = elliptic.utils.hash;

    // Using 256 bits mnemonic.
    const mnemonicStrength = 256;

    // Child key derivation.
    const reducer = function (acc, index) {
        let data =
            namespace.Core.Utils.concatTypedArrays(
                namespace.Core.Utils.concatTypedArrays(new Uint8Array([0]), acc.key),
                namespace.Core.Utils.uint32ToBytes(index));
        let result = hashUtils.hmac(hashUtils.sha512, acc.chain).update(data).digest();
        return { "key": result.slice(0, 32), "chain": result.slice(32) };
    };

    const replaceDerive = function (val) { return val.replace("'", ""); };

    /**
     * Handles mnemonic and master/child key derivation
     * according to SLIP-0010, SEP-0005 and BIP-39.
     * @class KeyTool
     * @param {String} lang The mnemonic language.
     * @memberof Litemint.Core
     */
    namespace.Core.KeyTool = function (lang) {
        if (!(this instanceof namespace.Core.KeyTool)) {
            throw new Error("ctor error");
        }
        this.reset(mnemonicStrength, lang);
    };

    // Set the language.
    namespace.Core.KeyTool.prototype.setLang = function (lang) {
        this.reset(mnemonicStrength, lang);
    };

    // Reset.
    namespace.Core.KeyTool.prototype.reset = function (strength, lang) {
        this.strength = strength;
        this.mnemonic = new Mnemonic(lang ? lang : "english");
    };

    // Split mnemonic words.
    namespace.Core.KeyTool.prototype.splitWords = function (mnemonic) {
        return this.mnemonic.splitWords(mnemonic);
    };

    // Create a new mnemonic from provided entropy or from random.
    namespace.Core.KeyTool.prototype.createMnemonic = function (entropy) {
        if (entropy) {
            if (entropy.length !== this.strength / 8) {
                throw new Error("Invalid entropy");
            }
            return this.mnemonic.toMnemonic(entropy);
        }
        else {
            return this.mnemonic.generate(this.strength);
        }
    };

    // Check whether the mnemonic words are valid.
    namespace.Core.KeyTool.prototype.checkMnemonic = function (words) {
        return this.mnemonic.check(words);
    };

    // Convert mnemonic to seed.
    namespace.Core.KeyTool.prototype.mnemonicToSeed = function (words, password) {
        return this.mnemonic.toSeed(words, password);
    };

    // Convert the seed to mnemonic
    namespace.Core.KeyTool.prototype.seedToMnemonic = function (seed) {
        return this.mnemonic.toMnemonic(seed);
    };

    // Generate the master key from seed.
    namespace.Core.KeyTool.prototype.generateMasterKey = function (seed) {
        return hashUtils.hmac(hashUtils.sha512, ed25519Key, "hex").update(seed, "hex").digest();
    };

    // Derive a child key.
    namespace.Core.KeyTool.prototype.deriveChildKey = function (path, masterKey) {
        let segments = path.split('/').slice(1).map(replaceDerive).map(el => parseInt(el, 10));
        return segments.reduce((keys, segment) => reducer(keys, segment + 0x80000000),
            { "key": masterKey.slice(0, 32), "chain": masterKey.slice(32) });
    };

    // Generate a Stellar key from derivation.
    namespace.Core.KeyTool.prototype.generateKey = function (derivation) {
        return StellarSdk.Keypair.fromRawEd25519Seed(derivation.key);
    };

    // Import a key from secret Stellar key.
    namespace.Core.KeyTool.prototype.importKey = function (secret) {
        return StellarSdk.Keypair.fromSecret(secret);
    };

    // Calculate a key from the pin (PBKDF2).
    namespace.Core.KeyTool.prototype.keyFromPin = function (pin, salt) {
        const pinbits = sjcl.codec.utf8String.toBits(pin);
        const saltbits = sjcl.codec.utf8String.toBits(salt);
        const result = sjcl.codec.hex.fromBits(sjcl.misc.pbkdf2(pinbits, saltbits, 2048, 512, function (key) {
            const hasher = new sjcl.misc.hmac(key, sjcl.hash.sha512);
            this.encrypt = function () {
                return hasher.encrypt.apply(hasher, arguments);
            };
        }));
        return namespace.Core.Utils.hexToBytes(result);
    };

})(window.Litemint = window.Litemint || {});
