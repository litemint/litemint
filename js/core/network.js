/**
 * @overview Litemint Core Network implementation.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {

    // Data stream interval.
    const streamInterval = 5000;

    // Data stream Id.
    let streamId = 0;

    // Event source.
    let eventSrc;

    // Watch event source.
    let watchEventSrc;

    // Instance of stellar SDK server.
    let stellarServer;

    /**
     * Handles connection to the stellar network allowing interacting
     * with accounts, operations and assets.
     * @class StellarNetwork
     * @memberof Litemint.Core
     */
    namespace.Core.StellarNetwork = function () {
        if (!(this instanceof namespace.Core.StellarNetwork)) {
            throw new Error("ctor error");
        }

        if (!stellarServer) {
            stellarServer = new StellarSdk.Server(namespace.config.serverUrl);
            StellarSdk.Network.usePublicNetwork();
        }
    };

    // Attach an account (setup the data stream).
    namespace.Core.StellarNetwork.prototype.attachAccount = function (streamCb) {
        this.detachAccount();

        return new Promise((resolve, reject) => {
            stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
                .then((account) => {
                    namespace.Core.currentAccount.data = account;
                    account.balances.forEach(function (asset) {
                        if (asset.asset_type === "native") {
                            namespace.Core.currentAccount.assets.push(
                                new namespace.Core.Asset("native", "XLM", asset.balance));
                        }
                        else {
                            let newAsset = new namespace.Core.Asset(asset.asset_issuer, asset.asset_code, asset.balance);
                            namespace.Core.currentAccount.assets.push(newAsset);
                        }
                    });

                    // Start the stream.
                    if (streamCb) {
                        let processRecord = (record) => {
                            if (record.type === "payment" || record.type === "manage_offer" || record.type === "create_passive_offer") {
                                stellarServer.transactions()
                                    .transaction(record.transaction_hash)
                                    .call()
                                    .then(function (opResult) {
                                        let op = namespace.Core.currentAccount.operations.find(item => item.transaction_hash === opResult.hash);
                                        if (op) {
                                            let txDetails = StellarSdk.xdr.TransactionEnvelope.fromXDR(opResult.envelope_xdr, "base64");
                                            op.memo = txDetails.tx().memo().value();
                                        }
                                    })
                                    .catch(function (error) {
                                        console.log(error);
                                    });
                            }
                        };

                        let queryTx = (count) => {
                            stellarServer.operations()
                                .forAccount(namespace.Core.currentAccount.keys.publicKey())
                                .order("desc")
                                .limit(count)
                                .call()
                                .then(function (page) {
                                    // Load the history.
                                    let full = false, valid = false, indexes = [];
                                    for (let i = page.records.length - 1; i >= 0; i -= 1) {
                                        if (!namespace.Core.currentAccount.operations.find(item => item.id === page.records[i].id)) {
                                            valid = true;
                                            let record = page.records[i];
                                            namespace.Core.currentAccount.operations.unshift(record);
                                            indexes.push(i);
                                            if (record.type === "allow_trust" || record.type === "change_trust") {
                                                full = true;
                                            }

                                            if (record.type === "payment" || record.type === "create_account") {
                                                if (count < namespace.config.maxOperations &&
                                                    record.to === namespace.Core.currentAccount.keys.publicKey()) {
                                                    if (record.type === "payment") {
                                                        namespace.Core.currentAccount.notifications.push(
                                                            {
                                                                "amount": record.amount,
                                                                "code": record.asset_code ? record.asset_code : "XLM"
                                                            }
                                                        );
                                                    }
                                                    else {
                                                        namespace.Core.currentAccount.notifications.push(
                                                            {
                                                                "amount": record.starting_balance,
                                                                "code": "XLM"
                                                            }
                                                        );
                                                    }
                                                }

                                                if (record.to && !namespace.Core.currentAccount.addresses.find(addr => addr === record.to)) {
                                                    namespace.Core.currentAccount.addresses.push(record.to);
                                                }
                                                if (record.from && !namespace.Core.currentAccount.addresses.find(addr => addr === record.from)) {
                                                    namespace.Core.currentAccount.addresses.push(record.from);
                                                }
                                            }

                                            processRecord(page.records[i]);
                                        }
                                    }
                                    namespace.Core.currentAccount.operations = namespace.Core.currentAccount.operations.slice(0, namespace.config.maxOperations);

                                    if (valid) {
                                        streamCb(full, indexes);
                                        if (!namespace.config.useNetworkPolling) {
                                            // Start the operations event stream.
                                            eventSrc = stellarServer.operations()
                                                .forAccount(namespace.Core.currentAccount.keys.publicKey())
                                                .cursor("now")
                                                .stream({
                                                    onmessage: function (record) {
                                                        let full = false;
                                                        namespace.Core.currentAccount.operations.unshift(record);
                                                        if (record.type === "allow_trust" || record.type === "change_trust") {
                                                            full = true;
                                                        }
                                                        console.log(record);
                                                        processRecord(record);
                                                        streamCb(full, []);
                                                    }
                                                });
                                            if (eventSrc) {
                                                console.info("Event source stream started for account:" + namespace.Core.currentAccount.keys.publicKey());
                                            }
                                        }
                                    }
                                })
                                .catch(function (error) {
                                    console.log(error);
                                });
                        };

                        if (namespace.config.useNetworkPolling) {
                            console.info("Polling stream started for account:" + namespace.Core.currentAccount.keys.publicKey());
                            streamId = setInterval(() => {
                                // Will do well up to 3 operations per seconds.
                                queryTx(15);
                            }, streamInterval);
                        }
                        queryTx(namespace.config.maxOperations);
                    }
                    return resolve();
            }).catch((err) => {
                return reject(err);
            });
        });
    };

    // Detach an account from data stream.
    namespace.Core.StellarNetwork.prototype.detachAccount = function () {
        namespace.Core.currentAccount.data = null;
        namespace.Core.currentAccount.assets = [];
        namespace.Core.currentAccount.operations = [];
        namespace.Core.currentAccount.addresses = [];
        namespace.Core.currentAccount.notifications = [];
        namespace.Core.currentAccount.friendlyAddress = null;

        if (streamId) {
            clearInterval(streamId);
            streamId = 0;
        }

        if (eventSrc) {
            eventSrc();
        }

        if (watchEventSrc) {
            watchEventSrc();
        }
    };

    // Watch an account for payment, notify the caller.
    // Used in account creation workflow.
    namespace.Core.StellarNetwork.prototype.watchAccount = function (account, cb) {
        watchEventSrc = stellarServer.payments()
            .cursor("now")
            .stream({
                onmessage: (message) => {
                    if (message.type === "create_account"
                        && account === message.account) {
                        watchEventSrc();
                        cb();
                    }
                }
            });
    };

    // Update the account.
    namespace.Core.StellarNetwork.prototype.updateAccount = function (reset) {
        return new Promise((resolve, reject) => {
            stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
                .then((account) => {
                    if (reset) {
                        namespace.Core.currentAccount.assets = [];
                    }

                    account.balances.forEach(function (asset) {
                        if (reset) {
                            if (asset.asset_type === "native") {
                                namespace.Core.currentAccount.assets.push(
                                    new namespace.Core.Asset("native", "XLM", asset.balance));
                            }
                            else {
                                let newAsset = new namespace.Core.Asset(asset.asset_issuer, asset.asset_code, asset.balance);
                                namespace.Core.currentAccount.assets.push(newAsset);
                            }
                        }
                        else {
                            const item = asset.asset_type === "native"
                                ? namespace.Core.currentAccount.assets.find(x => x.code === "XLM" && x.issuer === asset.asset_type)
                                : namespace.Core.currentAccount.assets.find(x => x.code === asset.asset_code && x.issuer === asset.asset_issuer);
                            if (item) {
                                item.balance = asset.balance;
                            }
                        }
                    });

                    namespace.Core.currentAccount.data = account;
                    return resolve(account);
            }).catch((error) => {
                return reject(error);
            });
        });
    };

    // Load an issuer account.
    namespace.Core.StellarNetwork.prototype.loadIssuerAccount = function (publicKey) {
        return new Promise((resolve, reject) => {
            stellarServer.loadAccount(publicKey).then((account) => {
                return resolve(account);
            }).catch((error) => {
                return reject(error);
            });
        });
    };

    // Load default assets.
    namespace.Core.StellarNetwork.prototype.loadDefaultAssets = function () {
        for (let i = 0; i < namespace.config.defaultAssets.length; i += 1) {
            const def = namespace.config.defaultAssets[i];
            def.asset = new namespace.Core.Asset(def.issuer, def.code, 0);
        }
    };

    // Send a payment.
    namespace.Core.StellarNetwork.prototype.sendPayment = function (destinationKey, asset, amount, memo, cb) {
        let seamlessAsset = namespace.config.seamlessAssets
            .find(x => x.code === asset.code && x.issuer === asset.issuer);
        if (seamlessAsset && namespace.Core.Utils.isValidBase58Address(destinationKey, seamlessAsset.networkPrefix)) {
            $.post(seamlessAsset.widthdraw, { "address": destinationKey },
                (response) => {
                    if (response) {
                        this.sendPayment(seamlessAsset.account, asset, amount, response, cb);
                    }
                    else {
                        cb(false, "Failed to retrieve payment id from the anchor.");
                    }
                });
        }
        else {
            namespace.Core.Account.ResolveAddress(destinationKey, (address, newMemo, newMemoType) => {
                let localMemo = StellarSdk.Memo.none();
                let memoType = "text";

                if (address) {
                    destinationKey = address;
                    if (newMemo) {
                        memo = newMemo;
                        if (newMemoType) {
                            memoType = newMemoType;
                        }
                    }
                }

                if (memo) {
                    switch (memoType) {
                        case "text":
                            localMemo = StellarSdk.Memo.text(memo);
                            break;
                        case "id":
                            localMemo = StellarSdk.Memo.id(memo);
                            break;
                        default:
                            // Unsupported for now.
                            cb(false, "Unsupported memo type.");
                            return;
                    }
                }

                stellarServer.loadAccount(destinationKey)
                    .then(function (destAccount) {
                        // TODO: test for asset trustline if not native.
                        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
                            .then(function (sourceAccount) {
                                let transaction = new StellarSdk.TransactionBuilder(sourceAccount)
                                    .addOperation(StellarSdk.Operation.payment({
                                        destination: destinationKey,
                                        asset: asset,
                                        amount: amount
                                    }))
                                    .addMemo(localMemo)
                                    .build();
                                transaction.sign(StellarSdk.Keypair.fromSecret(namespace.Core.currentAccount.keys.secret()));
                                return stellarServer.submitTransaction(transaction);
                            })
                            .then(function (result) {
                                cb(true, result);
                            })
                            .catch(function (error) {
                                cb(false, error);
                            });
                    }).catch((error) => {
                        if (error && error.response.status === 404 && !asset.issuer) {
                            // Try to create the account.
                            this.createAccount(destinationKey, amount, localMemo, cb);
                        }
                        else {
                            cb(false, error);
                        }
                    });
            });
        }
    };

    // Create an account on stellar.
    namespace.Core.StellarNetwork.prototype.createAccount = function (destinationKey, amount, memo, cb) {
        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then((sourceAccount) => {
                const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
                    .addOperation(StellarSdk.Operation.createAccount({
                        destination: destinationKey,
                        startingBalance: amount
                    }))
                    .addMemo(memo)
                    .build();
                transaction.sign(StellarSdk.Keypair.fromSecret(namespace.Core.currentAccount.keys.secret()));
                    return stellarServer.submitTransaction(transaction);
            })
            .then(function (result) {
                cb(true, result);
            })
            .catch(function (error) {
                cb(false, error);
            });
    };

    // Set a trustline on the account.
    namespace.Core.StellarNetwork.prototype.setTrust = function (asset, cb) {
        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then(function (receiver) {
                const transaction = new StellarSdk.TransactionBuilder(receiver)
                    .addOperation(StellarSdk.Operation.changeTrust({
                        asset: asset
                    }))
                    .build();
                transaction.sign(StellarSdk.Keypair.fromSecret(namespace.Core.currentAccount.keys.secret()));
                return stellarServer.submitTransaction(transaction);
            })
            .then(function (result) {
                cb(true, result);
            })
            .catch(function (error) {
                cb(false, error);
            });
    };

    // Remove a trustline from account.
    namespace.Core.StellarNetwork.prototype.removeTrust = function (asset, cb) {
        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then(function (receiver) {
                const transaction = new StellarSdk.TransactionBuilder(receiver)
                    .addOperation(StellarSdk.Operation.changeTrust({
                        asset: asset,
                        limit: "0" // Remove trustline.
                    }))
                    .build();
                transaction.sign(StellarSdk.Keypair.fromSecret(namespace.Core.currentAccount.keys.secret()));
                return stellarServer.submitTransaction(transaction);
            })
            .then(function (result) {
                cb(true, result);
            })
            .catch(function (error) {
                cb(false, error);
            });
    };

    /**
     * Represents an asset with auto verification from stellar.toml hosted on home domain.
     * @class Asset
     * @memberof Litemint.Core
     * @param {string} issuer Asset issuer key
     * @param {string} code Asset issuer code
     * @param {string} balance Asset account balance (if any).
     */
    namespace.Core.Asset = function (issuer, code, balance) {
        if (!(this instanceof namespace.Core.Asset)) {
            throw new Error("ctor error");
        }

        this.type = "asset";
        this.code = code;
        this.issuer = issuer;
        this.balance = balance;
        this.image = null;
        this.loaded = false;
        this.errored = false;
        this.verified = false;

        if (issuer === "native") {
            this.name = "Stellar Lumens";
            this.domain = "stellar.org";
            this.verified = true;
            this.loaded = true;
        }
        else {
            const stellarNet = new namespace.Core.StellarNetwork();
            stellarNet.loadIssuerAccount(this.issuer).then((result) => {
                if (result.home_domain) {
                    StellarSdk.StellarTomlResolver.resolve(result.home_domain)
                        // Query the toml.
                        .then(stellarToml => {
                            let found = false;
                            for (let i = 0; i < stellarToml.CURRENCIES.length; i += 1) {
                                let currency = stellarToml.CURRENCIES[i];
                                if (currency.code === this.code && currency.issuer === this.issuer) {
                                    this.name = currency.name ? currency.name : currency.code;
                                    this.domain = result.home_domain;
                                    this.description = currency.desc;
                                    this.conditions = currency.conditions;
                                    if (currency.image) {
                                        this.image = new Image();
                                        this.image.onload = () => {
                                            this.validImage = true;
                                            this.loaded = true;
                                        };
                                        this.image.onerror = () => {
                                            this.validImage = false;
                                            this.image = null;
                                            this.loaded = true;
                                        };
                                        this.image.src = currency.image;
                                    }
                                    else {
                                        this.loaded = true;
                                    }
                                    this.verified = true;
                                    this.decimals = currency.display_decimals;
                                    this.fixednum = currency.fixed_number;
                                    this.status = currency.status;
                                    found = true;

                                    let seamlessAsset = namespace.config.seamlessAssets.find(x => x.code === this.code && x.issuer === this.issuer);
                                    if (seamlessAsset) {
                                        // Retrieve the deposit address.
                                        $.post(seamlessAsset.deposit, { "address": namespace.Core.currentAccount.keys.publicKey() },
                                            (response) => {
                                                if (response) {
                                                    this.deposit = response;
                                                }
                                            });
                                    }

                                    break;
                                }
                            }

                            if (!found) {
                                // Unverified home domain (asset not found).
                                this.name = this.code;
                                this.domain = result.home_domain;
                                this.loaded = true;
                            }
                        })
                        .catch(error => {
                            console.log(JSON.stringify(error));
                            // Unverified home domain (no toml).
                            this.name = this.code;
                            this.loaded = true;
                        });
                }
                else {
                    // Unverified - no home domain.
                    this.name = this.code;
                    this.loaded = true;
                }
            }).catch((error) => {
                console.log(JSON.stringify(error));
                // Invalid account and unverified asset.
                this.name = this.code;
                this.errored = true;
                this.loaded = true;
            });
        }
    };
})(window.Litemint = window.Litemint || {});
