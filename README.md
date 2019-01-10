<h1 align="left"><a href="https://litemint.com" target="_blank" rel="noopener noreferrer"><img align=left width="75" src="https://litemint.com/300x300.png" alt="Litemint logo">Litemint</a></h1>

[![GitHub license](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/litemint/litemint/blob/master/LICENSE) [![Build Status](https://travis-ci.org/litemint/litemint.svg?branch=master)](https://travis-ci.org/litemint/litemint)

> The crypto world is limitless, explore it.

[https://litemint.com](https://litemint.com)

Sending and receiving crypto or selling and buying digital goods should be as simple as using your email. Built on Stellar, Litemint is a friendly multi-currency wallet and decentralized marketplace to do just that.

## Discover Litemint:

- Litemint accounts are standard, secure and compatible with all mainstream stellar services and hardware wallets. They implement mnemonic with [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), universal private key derivation with [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md) and [SEP-0005](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md) and can be recovered and imported independently.

- The marketplace is an exclusive feature allowing users to buy, sell and create merchant listings for digital goods from music to games (IAP) to ebooks. Merchants can receive payments directly. It leverages the anchor feature of Stellar.

- Litemint allows seamless in-wallet deposits and withdrawals from partners by using federation and secure endpoints to bridge the Stellar network to external networks.

## Building it Yourself

### Dependencies

The build process uses the [Google Closure Compiler](https://github.com/google/closure-compiler) and [YUI Compressor](https://github.com/yui/yuicompressor) which require [Java 8 or higher](https://www.java.com/). Follow their respective links for installation instructions.

Optionally, you can install [jsdoc](https://github.com/jsdoc3/jsdoc) if you want the build script to generate the code documentation.

### Build Script

1. Download the latest Litemint [source](https://github.com/litemint/litemint/releases) from releases.

2. Export the compiler and compressor paths. On the command line, run the following commands:
   ```shell
   export COMPILER=path/to/closure-compiler.jar
   export COMPRESSOR=path/to/yui-compressor.jar
   ```
   Alternatively, you can use the `--compiler` and `--compressor` command line flags (see example below).

3. At the root of this project, run the following command (by default, the release build is copied to the `dist/` folder):
   ```shell
   ./build.sh
   ```
   Or use the following command to use your debug build configuration and generate the output to `debug/` folder:
   ```shell
   ./build.sh --debug --out=debug
   ```
   Or use the following command to build and generate the [jsdoc](https://github.com/jsdoc3/jsdoc) documentation (jsdoc must be in the path):
   ```shell
   ./build.sh --jsdoc=doc
   ```
   Or use the following command to specify the compiler and compressor paths:
   ```shell
   ./build.sh --compiler=path/to/closure-compiler.jar --compressor=path/to/yui-compressor.jar
   ```
   
## Contributing

Got mad skills? You are welcome to contribute to Litemint!

Development on Litemint happens directly on this GitHub repository and external contributors are welcome to send [pull requests](https://help.github.com/articles/about-pull-requests) which will be reviewed and discussed.

Please take a look at the [Code of Conduct](https://github.com/FredericRezeau/litemint-js-dev/blob/master/CONTRIB.md) to learn more.

Trying to report a possible security vulnerability in Litemint? For the safe disclosure of security bugs and information about our bounty program, please send an email to [security@litemint.com](mailto:security@litemint.com).

## Litemint License

Litemint source code is released under the [MIT License](https://github.com/FredericRezeau/litemint-js-dev/blob/master/LICENSE).

Copyright (c) 2018 Frederic (경진) Rezeau<br />
Copyright (c) 2018 Litemint LLC

> LITEMINT LLC owns all Litemint-related trademarks, service marks, and graphic logos and the names of all Litemint projects are trademarks of LITEMINT LLC.

## Dependency Licenses

Build on the shoulders of giants!

### Elliptic (Elliptic Curve Cryptography)

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/indutny/elliptic</td>
  </tr>
  <tr>
    <td>License</td>
    <td>MIT License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>Modified to expose the hash cryptography primitives</td>
  </tr>
</table>

### aes-js (Advanced Encryption Standard)

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/ricmoo/aes-js</td>
  </tr>
  <tr>
    <td>License</td>
    <td>MIT License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### scrypt-async-js

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/dchest/scrypt-async-js</td>
  </tr>
  <tr>
    <td>License</td>
    <td>MIT License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### tweetnacl-js

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/dchest/tweetnacl-js</td>
  </tr>
  <tr>
    <td>License</td>
    <td>The Unlicense</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### js-stellar-sdk

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/stellar/js-stellar-sdk</td>
  </tr>
  <tr>
    <td>License</td>
    <td>Apache-2.0 License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### bip39

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/iancoleman/bip39</td>
  </tr>
  <tr>
    <td>License</td>
    <td>MIT License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### jquery

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/jquery/jquery</td>
  </tr>
  <tr>
    <td>License</td>
    <td>MIT License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### material-design-icons

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/google/material-design-icons</td>
  </tr>
  <tr>
    <td>License</td>
    <td>Apache-2.0 License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### Chart.js

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/chartjs/Chart.js</td>
  </tr>
  <tr>
    <td>License</td>
    <td>MIT License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>

### jquery-qrcode

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/jeromeetienne/jquery-qrcode</td>
  </tr>
  <tr>
    <td>License</td>
    <td>MIT License</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>
