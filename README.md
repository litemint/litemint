<h1 align="left"><a href="https://litemint.com" target="_blank" rel="noopener noreferrer"><img align=left width="75" src="https://cdn.litemint.com/static/logosmall.png" alt="Litemint logo">Litemint</a></h1>

[![GitHub license](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/litemint/litemint/blob/master/LICENSE)

> Forge your legacy.

[app.litemint.com](https://app.litemint.com) is a bespoke, open-source, non-custodial Stellar wallet built for gamers and digital collectors.

It offers true asset ownership, peer-to-peer payments, and native support for collectibles and NFTs on the Stellar blockchain.

## Accounts
- Fully **non-custodial** — private keys never leave your device
- Compatible with all mainstream stellar services and hardware wallets
- Mnemonic recovery using [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- Deterministic key derivation via [SLIP-0010](https://github.com/satoshilabs/slips/blob/master/slip-0010.md) and [SEP-0005](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md)
- Accounts can be recovered or imported independently of Litemint

## Collectibles
- Send and receive any Stellar asset or NFT
- Peer-to-peer trading via the Stellar DEX (SDEX)
- Supports all stellar assets including USDC and more.
- Secure, protocol-native, and easy to use

### Links

- Website: https://litemint.com/
- Discord: https://litemint.gg
- X (Twitter): https://twitter.com/LitemintHQ
- Facebook: https://www.facebook.com/litemint
- Youtube: https://www.youtube.com/litemint
- Wallet Web App: https://app.litemint.com/
- Blog: https://blog.litemint.com/

## Building It Yourself

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

Contributions are welcome.

Development on Litemint happens directly on this GitHub repository and external contributors are welcome to send [pull requests](https://help.github.com/articles/about-pull-requests) which will be reviewed and discussed.

Please take a look at the [Code of Conduct](https://github.com/litemint/litemint/blob/master/CONTRIB.md) to learn more.

## Litemint License

Litemint source code is released under the [MIT License](https://github.com/litemint/litemint/blob/master/LICENSE).

Copyright (c) 2021 Frederic Rezeau, aka 오경진<br />
Copyright (c) 2021 Litemint LLC

> LITEMINT LLC owns all Litemint-related trademarks, service marks, and graphic logos and the names of all Litemint projects are trademarks of LITEMINT LLC.