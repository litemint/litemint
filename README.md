<h1 align="left"><a href="https://litemint.com" target="_blank" rel="noopener noreferrer"><img align=left width="75" src="https://litemint.com/300x300.png" alt="Litemint logo">Litemint</a></h1>

[![GitHub license](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/litemint/litemint/blob/master/LICENSE) [![Build Status](https://travis-ci.org/litemint/litemint.svg?branch=master)](https://travis-ci.org/litemint/litemint)

> Explore the crypto world.

[https://litemint.com](https://litemint.com)

Litemint is an open source, noncustodial, bespoke Stellar wallet for gamers. By leveraging the Stellar blockchain, Litemint enhances the user experience with asset ownership (NFT and collectibles) and decentralized micro-transactions.

Check out the [litemint-api](https://github.com/litemint/litemint-api) to integrate your app to Litemint.

## Discover Litemint:

- Send, receive and trade any digital asset. Litemint is decentralized, secure and friendly.

- Your account keys always stay with you! Litemint accounts are standard, secure and compatible with all mainstream stellar services and hardware wallets. They implement mnemonic with [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), universal private key derivation with [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md) and [SEP-0005](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md) and can be recovered and imported independently.

- Litemint allows third-party apps and games to run seamlessly from within the wallet while also delivering monetizable content such as tradable collectibles and items through dedicated shopping services. Litemint boasts of the first real-world implementation of decentralized cross-currency in-app purchases using path payments.

- Fast growing. See [Google Analytics Report for Q3](https://datastudio.google.com/s/oCISrGU9RnY) and latest report [latest report](https://datastudio.google.com/s/mSCu0Ccx4Qs).

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

Please take a look at the [Code of Conduct](https://github.com/litemint/litemint/blob/master/CONTRIB.md) to learn more.

Trying to report a possible security vulnerability in Litemint? For the safe disclosure of security bugs and information about our bounty program, please send an email to [security@litemint.com](mailto:security@litemint.com).

## Litemint License

Litemint source code is released under the [MIT License](https://github.com/litemint/litemint/blob/master/LICENSE).

Copyright (c) 2020 Frederic Rezeau, aka 오경진<br />
Copyright (c) 2020 Litemint LLC

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

### bulma

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/jgthms/bulma</td>
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

### identicons

<table>
  <tr>
    <td>URL</td>
    <td>https://github.com/Lobstrco/stellar-identicon-js</td>
  </tr>
  <tr>
    <td>License</td>
    <td>Apache License 2.0</td>
  </tr>
  <tr>
    <td>Local Modifications</td>
    <td>None</td>
  </tr>
</table>
