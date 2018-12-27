/**
 * @overview Litemint Core Utils implementation.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {

    /**
     * Generate an array of random bytes. Defaults to using the Web Crypto API
     * available in most modern browsers.
     * @function getRandomBytes
     * @memberof Litemint.Core.Utils
     * @param {Number} count Length of the array.
     * @return {Uint8Array} Byte array.
     */
    namespace.Core.Utils.getRandomBytes = function (count) {
        /*
            https://www.w3.org/TR/WebCryptoAPI/#Crypto-method-getRandomValues
            Specs: Implementations should generate cryptographically random values
            using well-established cryptographic pseudo-random number generators seeded
            with high-quality entropy, such as from an operating
            system entropy source(e.g., "/dev/urandom").
        */
        return elliptic.rand(count);
    };

    /**
     * Convert a byte array to hex string.
     * @function bytesToHex
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} bytes Byte array to convert.
     * @return {String} Hexadecimal String.
     */
    namespace.Core.Utils.bytesToHex = function (bytes) {
        return bytes.reduce(function (data, i) { return data + ("0" + i.toString(16)).slice(-2); }, "");
    };

    /**
     * Convert a hexadecimal string to byte array.
     * @function hexToBytes
     * @memberof Litemint.Core.Utils
     * @param {String} hex Hexadecimal String to convert.
     * @return {Uint8Array} Byte array.
     */
    namespace.Core.Utils.hexToBytes = function (hex) {
        return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    };

    /**
     * Convert an unsigned 32-bit integer to byte array (big endian).
     * @function uint32ToBytes
     * @memberof Litemint.Core.Utils
     * @param {uint32} uint32 Unsigned 32-bit integer to convert.
     * @return {Uint8Array} Byte array.
     */
    namespace.Core.Utils.uint32ToBytes = function (uint32) {
        return new Uint8Array([uint32 >>> 24, uint32 >>> 16, uint32 >>> 8, uint32 & 0xff]);
    };

    /**
     * Convert a byte array to unsigned 32-bit integer (big endian).
     * @function bytesToUint32
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} bytes Byte array to convert.
     * @return {uint32} Unsigned 32-bit integer.
     */
    namespace.Core.Utils.bytesToUint32 = function (bytes) {
        return new Uint32Array(namespace.Core.Utils.xorSwap(bytes).buffer)[0];
    };

    /**
     * Convert an unsigned 16-bit integer to byte array (big endian).
     * @function uint16ToBytes
     * @memberof Litemint.Core.Utils
     * @param {uint16} uint16 Unsigned 16-bit integer to convert.
     * @return {Uint8Array} Byte array.
     */
    namespace.Core.Utils.uint16ToBytes = function (uint16) {
        return new Uint8Array([uint16 >> 8, uint16]);
    };

    /**
     * Convert a byte array to unsigned 16-bit integer (big endian).
     * @function bytesToUint16
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} bytes Byte array to convert.
     * @return {uint16} Unsigned 16-bit integer.
     */
    namespace.Core.Utils.bytesToUint16 = function (bytes) {
        return new Uint16Array(namespace.Core.Utils.xorSwap(bytes).buffer)[0];
    };

    /**
     * Convert a Utf8 string to byte array.
     * @function utf8ToBytes
     * @memberof Litemint.Core.Utils
     * @param {String} string Utf8 String to convert.
     * @return {Uint8Array} Byte array.
     */
    namespace.Core.Utils.utf8ToBytes = function (string) {
        return aesjs.utils.utf8.toBytes(string);
    };

    /**
     * Convert a byte array to Utf8 string.
     * @function bytesToUtf8
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} bytes  Byte array to convert.
     * @return {String} Utf8 String.
     */
    namespace.Core.Utils.bytesToUtf8 = function (bytes) {
        return aesjs.utils.utf8.fromBytes(bytes);
    };

    /**
     * Concatenate two typed arrays.
     * @function concatTypedArrays
     * @memberof Litemint.Core.Utils
     * @param {Array} a  Typed array to concatenate.
     * @param {Array} b  Typed array to concatenate.
     * @return {Array} Concatenated array.
     */
    namespace.Core.Utils.concatTypedArrays = function (a, b) {
        let c = new a.constructor(a.length + b.length);
        c.set(a, 0);
        c.set(b, a.length);
        return c;
    };

    /**
     * Copy the byte array into a new one.
     * @function copyBytes
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} src  Byte array to copy.
     * @return {Uint8Array} Copied array.
     */
    namespace.Core.Utils.copyBytes = function (src) {
        let dst = new Uint8Array(src.length);
        dst.set(src);
        return dst;
    };

    /**
     * Swap the bytes using XOR swap method.
     * @function xorSwap
     * @memberof Litemint.Core.Utils
     * @param {Array} array  Byte array to swap.
     * @return {Array} Swapped array.
     */
    namespace.Core.Utils.xorSwap = function (array) {
        for (let i = 0, r = array.length - 1; i < r; i += 1, r -= 1) {
            let left = array[i];
            let right = array[r];
            left ^= right;
            right ^= left;
            left ^= right;
            array[i] = left;
            array[r] = right;
        }
        return array;
    };

    /**
     * Determine whether the number is odd or even.
     * @function isOdd
     * @memberof Litemint.Core.Utils
     * @param {Number} b Number to test.
     * @return {Boolean} True or False
     */
    namespace.Core.Utils.isOdd = function (b) {
        return b & 1 ? true : false;
    };

    /**
     * Convert a utf8 string to byte array and pad with zeros.
     * @function pad16
     * @memberof Litemint.Core.Utils
     * @param {String} str String to convert
     * @return {Uint8Array} Byte array
     */
    namespace.Core.Utils.pad16 = function (str) {
        const bytes = namespace.Core.Utils.utf8ToBytes(str);
        const padLen = (parseInt(bytes.length / 16) + 1) * 16 - bytes.length;
        return namespace.Core.Utils.concatTypedArrays(bytes, new Uint8Array(padLen));
    };

    /**
     * Unpad a byte array and convert back to utf8 string.
     * @function unpad16
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} array Byte array to convert
     * @return {String} Utf8 string
     */
    namespace.Core.Utils.unpad16 = function (array) {
        const start = array.length - 1;
        let len = 0;
        for (let i = start; i >= start - 16; i -= 1) {
            if (array[i] === 0) {
                len += 1;
            }
        }
        let buffer = new Uint8Array(array.length - len);
        for (let i = 0; i < buffer.length; i += 1) {
            buffer[i] = array[i];
        }
        return namespace.Core.Utils.bytesToUtf8(buffer);
    };

    /**
     * Exclusive OR between 2 byte arrays.
     * @function xorBytes
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} l Left byte array.
     * @param {Uint8Array} r Right byte array.
     * @return {Uint8Array} XOR-ed array.
     */
    namespace.Core.Utils.xorBytes = function (l, r) {
        let buffer = new Uint8Array(Math.min(l.length, r.length));
        for (let i = 0; i < r.length; i += 1) {
            buffer[i] = l[i] ^ r[i];
        }
        return buffer;
    };

    /**
     * Test byte arrays equality over the specified length.
     * @function bytesEqual
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} l Left byte array.
     * @param {Uint8Array} r Right byte array.
     * @param {Number} length length to test.
     * @return {Boolean} True or False.
     */
    namespace.Core.Utils.bytesEqual = function (l, r, length) {
        for (let i = 0; i < length; i += 1) {
            if (r[i] !== l[i]) {
                return false;
            }
        }
        return true;
    };

    /**
     * Return the time stripped from milliseconds.
     * @function getTime
     * @memberof Litemint.Core.Utils
     * @return {Number} Epoch time.
     */
    namespace.Core.Utils.getTime = function () {
        return Math.round(Date.now() / 1000.0);
    };

    /**
     * Securely shuffle an array (Durstenfeld method).
     * @function secureShuffle
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} array Byte array to shuffle.
     * @param {Uint8Array} seed Entropy seed.
     * @return {Uint8Array} Shuffled array.
     */
    namespace.Core.Utils.secureShuffle = function (array, seed) {
        const randomNumbers = seed && seed.length === array.length
            ? seed
            : namespace.Core.Utils.getRandomBytes(array.length);
        for (let i = array.length - 1; i > 0; i -= 1) {
            let j = parseInt(randomNumbers[array.length - i - 1] % array.length);
            let temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    };

    /**
     * Encode a byte array to base58.
     * @function arrayToBase58
     * @memberof Litemint.Core.Utils
     * @param {Uint8Array} array Byte array to encode.
     * @return {String} Encoded string.
     */
    namespace.Core.Utils.arrayToBase58 = function (array) {
        return Base58Encoder.encode(array);
    };

    /**
     * Decode a base58 string to a byte array.
     * @function base58ToArray
     * @memberof Litemint.Core.Utils
     * @param {String} string String to decode.
     * @return {Uint8Array} Decoded byte array.
     */
    namespace.Core.Utils.base58ToArray = function (string) {
        return Base58Encoder.decode(string);
    };

    /**
     * Determine whether the base58 string is a valid address (from checksum).
     * @function isValidBase58Address
     * @memberof Litemint.Core.Utils
     * @param {String} address Address to decode.
     * @param {String} prefix Network prefix.
     * @return {Boolean} Checksum verified or not.
     */
    namespace.Core.Utils.isValidBase58Address = function (address, prefix) {
        const hashUtils = elliptic.utils.hash;
        const decoded = namespace.Core.Utils.base58ToArray(address);
        if (decoded && decoded.length === 25 && decoded[0] === prefix) {
            const checksum = decoded.slice(-4);
            const data = decoded.slice(0, decoded.length - 4);
            if (namespace.Core.Utils.bytesEqual(checksum,
                hashUtils.sha256().update(hashUtils.sha256().update(data).digest()).digest(), 4)) {
                return true;
            }
        }
        return false;
    };

})(window.Litemint = window.Litemint || {});
