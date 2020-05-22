/**
 * @overview Litemint Core Network implementation.
 * @copyright 2018-2020 Frederic Rezeau, aka 오경진.
 * @copyright 2018-2020 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {

    // Data stream interval.
    const streamInterval = 5000;

    // Data stream Id.
    let streamId = 0;

    // Watch event source.
    let watchEventSrc;

    // Instance of stellar SDK server.
    let stellarServer;

    // Network passphrase.
    let networkPassphrase = StellarSdk.Networks.PUBLIC;
 
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

            // Retrieve the base fee and reserve.
            $.ajax(namespace.config.serverUrl + "/fee_stats").then(
                function success(response) {
                    if (response && response.last_ledger) {
                        stellarServer.ledgers()
                            .ledger(response.last_ledger)
                            .call()
                            .then(function(ledgerResult) {
                                if(ledgerResult 
                                    && ledgerResult.base_fee_in_stroops 
                                    && ledgerResult.base_reserve_in_stroops) {
                                        const stroop = 0.0000001;
                                        namespace.Core.stellarBaseFee = ledgerResult.base_fee_in_stroops * stroop;
                                        namespace.Core.stellarBaseReserve = ledgerResult.base_reserve_in_stroops * stroop;
                                    }
                            })
                            .catch(function(err) {
                                console.log(err)
                            })
                    }
                },
                function fail(data, status) {
                    console.error("Failed to get fee stats: " + status);
                }
            );
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
                        let queryTx = (count) => {
                            stellarServer.operations()
                                .forAccount(namespace.Core.currentAccount.keys.publicKey())
                                .order("desc")
                                .limit(count)
                                .call()
                                .then(function (page) {
                                    // Load the operations history.
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
                                            else if (record.type === "payment" || record.type === "create_account") {
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

                                            if (record.type === "payment" || 
                                                record.type === "manage_offer" || 
                                                record.type === "manage_sell_offer" || 
                                                record.type === "manage_buy_offer" || 
                                                record.type === "create_passive_offer" ||
                                                record.type === "create_passive_sell_offer") {
                                                stellarServer.transactions()
                                                    .transaction(record.transaction_hash)
                                                    .call()
                                                    .then(function (opResult) {
                                                        let op = namespace.Core.currentAccount.operations.find(item => item.transaction_hash === opResult.hash);
                                                        if (op) {
                                                            let txDetails = StellarSdk.TransactionBuilder.fromXDR(opResult.envelope_xdr, networkPassphrase);
                                                            op.memo = txDetails.tx.memo().value();
                                                        }
                                                    })
                                                    .catch(function (error) {
                                                        console.error(error);
                                                    });
                                            }
                                        }
                                    }
                                    namespace.Core.currentAccount.operations = namespace.Core.currentAccount.operations.slice(0, namespace.config.maxOperations);

                                    if (valid) {
                                        streamCb(full, indexes);
                                    }

                                    stellarServer.offers()
                                        .forAccount(namespace.Core.currentAccount.keys.publicKey())
                                        .limit(namespace.config.maxOrders)
                                        .call()
                                        .then((offerResult) => {
                                            let updateOffers = false, offers = [];
                                            for (let i = 0; i < offerResult.records.length; i += 1) {
                                                let record = offerResult.records[i];                                                
                                                if (record.selling && record.buying) {
                                                    if (!updateOffers) {
                                                        if (!namespace.Core.currentAccount.offers.find((offer) => {
                                                            return offer.id === record.id && offer.last_modified_ledger === record.last_modified_ledger })) {
                                                            updateOffers = true;
                                                            console.log(record);
                                                        }
                                                    }

                                                    let offer = {
                                                        "id": record.id,
                                                        "baseAsset": record.selling.asset_type === "native" ? StellarSdk.Asset.native() : new StellarSdk.Asset(record.selling.asset_code, record.selling.asset_issuer),
                                                        "quoteAsset": record.buying.asset_type === "native" ? StellarSdk.Asset.native() : new StellarSdk.Asset(record.buying.asset_code, record.buying.asset_issuer),
                                                        "price": { n: record.price_r.n, d: record.price_r.d },
                                                        "baseAmount": record.amount,
                                                        "quoteAmount": (Number(record.amount) * (record.price_r.n / record.price_r.d)).toFixed(7),
                                                        "last_modified_ledger": record.last_modified_ledger
                                                    };
                                                    offers.push(offer);
                                                }
                                            }

                                            if (!updateOffers) {
                                                for (let i = 0; i < namespace.Core.currentAccount.offers.length; i += 1) {
                                                    let record = namespace.Core.currentAccount.offers[i];
                                                    if (!offers.find((offer) => {
                                                        return offer.id === record.id && offer.last_modified_ledger === record.last_modified_ledger
                                                    })) {
                                                        updateOffers = true;
                                                    }
                                                }
                                            }

                                            if (updateOffers) {
                                                namespace.Core.currentAccount.offers = offers;
                                                streamCb(false, [], true);
                                            }
                                        })
                                        .catch((err) => {
                                            console.error(err);
                                        });
                                })
                                .catch(function (error) {
                                    console.error(error);
                                });
                        };

                        console.log("Polling stream started for account:" + namespace.Core.currentAccount.keys.publicKey());
                        streamId = setInterval(() => {
                            // Will do well up to 3 operations per seconds.
                            queryTx(15);
                        }, streamInterval);
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
        namespace.Core.currentAccount.offers = [];
        namespace.Core.currentAccount.addresses = [];
        namespace.Core.currentAccount.notifications = [];
        namespace.Core.currentAccount.friendlyAddress = null;

        if (streamId) {
            clearInterval(streamId);
            streamId = 0;
        }

        if (watchEventSrc) {
            try {
                watchEventSrc();
            }
            catch (err) {
                // Event source not available seems to be causing exception
                // in stellar sdk for MS Edge. Let's not bother during the signout process.
                console.error(err);
            }
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

    // Verify NFT contract.
    namespace.Core.StellarNetwork.prototype.verifyNFTContract = function (code, issuer, account, cb) {
        let contract = { code, issuer };

        // An NFT contract is valid IFF:
        //
        //      • The issuer has ONNE zero-weighted signer.
        //      • The issuer has ONNE transaction.
        //      • The transaction created ONNE account.
        //      • The transaction created the issuer account.
        //      • The transaction has ONNE set_options operation.
        //      • The transaction has ONNE payment operation from issuer.
        //      • The issuer payment operation amount is equal to 0.0000001 XLM (one stroop).
        //
        // IFF = If and only if.
        // ONNE = One and only one.

        // First check for performance reasons so we can quickly
        // bail out on most non NFT assets.
        if (account.signers.length === 1 && account.signers[0].weight === 0) {
            contract.domain = account.home_domain;
            stellarServer.transactions()
                .forAccount(issuer)
                .call()
                .then(function (results) {
                    if (results.records.length === 1 && results.records[0].successful) {
                        contract.memo = results.records[0].memo;
                        contract.id = results.records[0].id;
                        contract.source = results.records[0].source_account;
                        contract.data = [];
                        contract.traits = [];
                        stellarServer.operations()
                            .forTransaction(contract.id)
                            .call()
                            .then(function (opResults) {
                                let atomicCreation = 0;
                                let atomicIssuer = 0;
                                let atomicIssuance = 0;
                                let atomicUnit = 0;
                                let atomicOptions = 0;
                                let atomicFreeze = 0;

                                for (let i=0; i< opResults.records.length; i += 1) {
                                    if (opResults.records[i].type === "create_account") {
                                        atomicCreation += 1;
                                        if (opResults.records[i].account === issuer) {
                                            atomicIssuer += 1;
                                        }
                                    }
                                    else if (opResults.records[i].type === "payment"
                                    && opResults.records[i].asset_code === code
                                    && opResults.records[i].asset_issuer === issuer) {
                                        atomicIssuance += 1;
                                        if (opResults.records[i].amount === "0.0000001") {
                                            atomicUnit += 1;
                                        }
                                    }
                                    else if (opResults.records[i].type === "set_options") {
                                        atomicOptions += 1;
                                        if(atomicOptions === 1 && opResults.records[i].master_key_weight === 0) {
                                            atomicFreeze += 1;
                                        }
                                    }
                                    else if (opResults.records[i].type === "payment") {
                                        contract.traits.push({
                                            "code": opResults.records[i].asset_code,
                                            "issuer": opResults.records[i].asset_issuer
                                            })
                                    }
                                    else if (opResults.records[i].type === "manage_data") {
                                        contract.data.push( {
                                            "name": opResults.records[i].name,
                                            "value": opResults.records[i].value } );
                                    }
                                }
                                
                                if (atomicCreation === 1
                                    && atomicIssuer === 1
                                    && atomicIssuance === 1
                                    && atomicUnit === 1
                                    && atomicOptions === 1
                                    && atomicFreeze === 1) {
                                        contract.valid = true;
                                }
                                cb(contract);
                            })
                            .catch(function (err) {
                                cb(contract, err);
                            });
                    }
                })
                .catch(function (err) {
                    cb(contract, err);
                });
        }
        else {
            cb(contract);
        }
    };

    // Reference implementation for the NFT contract.
    namespace.Core.StellarNetwork.prototype.createNFTContract = function (code, memo, domain, traits, metadata, cb) {
        const stroop = 0.0000001;
        const issuer = StellarSdk.Keypair.random();
        const reserveIssuer = (1 + namespace.Core.currentAccount.getBaseReserve() * metadata.length).toFixed(7);
        const asset = new StellarSdk.Asset(code, issuer.publicKey());

        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then(function (sourceAccount) {

            // Issuer account creation and trustline operations.
            let builder = new StellarSdk.TransactionBuilder(sourceAccount, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                    .addOperation(StellarSdk.Operation.createAccount({
                        destination: issuer.publicKey(),
                        startingBalance: reserveIssuer.toString()
                    }))
                    .addOperation(StellarSdk.Operation.changeTrust({
                        asset: asset
                    }))
                    .setTimeout(60);

            // Add a memo if specified.
            if (memo) {
                builder.addMemo(memo);
            }

            // Add the traits.
            for (let i = 0; i < traits.length; i += 1) {
                builder = builder.addOperation(StellarSdk.Operation.payment({
                    destination: namespace.Core.currentAccount.keys.publicKey(),
                    asset: traits[i],
                    amount: stroop.toString()
                }));
            }

            // Add meta data.
            for (let i = 0; i < metadata.length; i += 1) {
                builder = builder.addOperation(StellarSdk.Operation.manageData({
                    name: metadata[i].key,
                    value: metadata[i].value,
                    source: issuer.publicKey()
                }));
            }

            // Issue to owner.
            builder = builder.addOperation(StellarSdk.Operation.payment({
                destination: namespace.Core.currentAccount.keys.publicKey(),
                asset: asset,
                source: issuer.publicKey(),
                amount: stroop.toString()
            }));

            // Freeze the issuer account forever.
            let options = {
                masterWeight: 0,
                source: issuer.publicKey()
            }
            if (domain) {
                options.homeDomain = domain;
            }
            builder = builder.addOperation(StellarSdk.Operation.setOptions(options));

            // Build and sign (issuer and owner).
            let transaction = builder.build();
            transaction.sign(StellarSdk.Keypair.fromSecret(namespace.Core.currentAccount.keys.secret()));
            transaction.sign(StellarSdk.Keypair.fromSecret(issuer.secret()));

            return stellarServer.submitTransaction(transaction);
        })
        .then(function (result) {
            cb(true, result, {
                "issuer": issuer,
            });
        })
        .catch(function (error) {
            cb(false, error);
        });
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
                    .then((destAccount) => {
                        if (this.hasTrustline(destAccount, asset)) {
                            stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
                                .then(function (sourceAccount) {
                                    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                                        .addOperation(StellarSdk.Operation.payment({
                                            destination: destinationKey,
                                            asset: asset,
                                            amount: amount
                                        }))
                                        .addMemo(localMemo)
                                        .setTimeout(60)
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
                        }
                        else {
                            cb(false, "Trustline not set.");
                        }
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
                const transaction = new StellarSdk.TransactionBuilder(sourceAccount, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                    .addOperation(StellarSdk.Operation.createAccount({
                        destination: destinationKey,
                        startingBalance: amount
                    }))
                    .addMemo(memo)
                    .setTimeout(60)
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

    // Find payment paths.
    namespace.Core.StellarNetwork.prototype.findPaymentPaths = function (account, code, issuer, amount, id, cb) {
        const asset = (issuer === "native") 
            ? StellarSdk.Asset.native() 
            : new StellarSdk.Asset(code, issuer);
        stellarServer.strictReceivePaths(namespace.Core.currentAccount.keys.publicKey(), asset, amount)
            .call()
            .then(function (pathResult) {
                cb(true, pathResult.records, code, issuer, id);
            })
            .catch(function (error) {
                cb(false, error);
            });
    };

    // Send path payment.
    namespace.Core.StellarNetwork.prototype.sendPathPayment = function (id, srccode, srcissuer, srcamount, 
        destcode, destissuer, destamount, destaccount, pathassets, cb) {
        const srcasset = (srcissuer === "native") 
            ? StellarSdk.Asset.native() : new StellarSdk.Asset(srccode, srcissuer);    
        const destasset = (destissuer === "native") 
            ? StellarSdk.Asset.native() : new StellarSdk.Asset(destcode, destissuer);

        const memo = StellarSdk.Memo.text(id);

        let path = [];
        for (let i = 0; i < pathassets.length; i += 1) {
            let asset = (pathassets[i].asset_type === "native")
                ? StellarSdk.Asset.native() : new StellarSdk.Asset(pathassets[i].asset_code, pathassets[i].asset_issuer);
            path.push(asset);
        }

        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then((sourceAccount) => {
                const transaction = new StellarSdk.TransactionBuilder(sourceAccount, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                    .addOperation(StellarSdk.Operation.pathPaymentStrictReceive({
                        sendAsset: srcasset,
                        sendMax: srcamount,
                        destination: destaccount,
                        destAsset: destasset,
                        destAmount: destamount,
                        path: path
                    }))
                    .addMemo(memo)
                    .setTimeout(60)
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

    // Check the account has established a trustline to the asset.
    namespace.Core.StellarNetwork.prototype.hasTrustline = function (account, asset) {
        const trusted =
            asset.code === "XLM" || // Native is always trusted.
            asset.issuer === account.id || // Issuer is always trusted.
            account.balances.some((balance) => { // An explicit balance must exist.
                return balance.asset_code === asset.code && balance.asset_issuer === asset.issuer;
            });
        return trusted;
    };

    // Set a trustline on the account.
    namespace.Core.StellarNetwork.prototype.setTrust = function (asset, cb) {
        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then(function (receiver) {
                const transaction = new StellarSdk.TransactionBuilder(receiver, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                    .addOperation(StellarSdk.Operation.changeTrust({
                        asset: asset
                    }))
                    .setTimeout(60)
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
                const transaction = new StellarSdk.TransactionBuilder(receiver, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                    .addOperation(StellarSdk.Operation.changeTrust({
                        asset: asset,
                        limit: "0" // Remove trustline.
                    }))
                    .setTimeout(60)
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

    // Send offer.
    namespace.Core.StellarNetwork.prototype.sendOffer = function (cb) {
        const order = namespace.Core.currentAccount.processingOrder;

        // In all cases, try to represent price as rational number
        // for maximum precicion.
        let price = order.price;
        if (typeof price === "object" && price.n && price.d) {
            price = {
                "n": order.isBuy ? order.price.d : order.price.n,
                "d": order.isBuy ? order.price.n : order.price.d
            }
        }
        else if (!isNaN(price)) {
            try {
                // Note that with Stellar, numerator and denominator
                // are limited to 32-bit integers!
                const checkPriceBounds = (price) => {
                    return price.d && price.n && price.d < namespace.Core.Utils.MaxInt32 && price.n < namespace.Core.Utils.MaxInt32;
                }

                let rational = new Fraction(price);
                if (!checkPriceBounds(rational)) {
                    rational = new Fraction(1 / price);
                    if (!checkPriceBounds(rational)) {
                        throw new Error("Fractional price out of bounds.");
                    }
                    price = {
                        "n": order.isBuy ? rational.n : rational.d,
                        "d": order.isBuy ? rational.d : rational.n
                    }
                }
                else {
                    price = {
                        "n": !order.isBuy ? rational.n : rational.d,
                        "d": !order.isBuy ? rational.d : rational.n
                    }
                }
            }
            catch (err) {
                console.error(err);
                // Fall back to using the actual number.
                price = (order.isBuy ? 1 / Number(price) : Number(price)).toFixed(7);
            }
        }

        // Convert buy/sell order to an offer.
        const offer = {
            selling: order.isBuy ? order.quote : order.base,
            buying: order.isBuy ? order.base : order.quote,
            amount: order.isBuy ? order.quoteAmount : order.baseAmount,
            price: price,
            offerId: "0"
        };

        console.log(offer);

        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then(function (receiver) {
                const transaction = new StellarSdk.TransactionBuilder(receiver, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                    .addOperation(StellarSdk.Operation.manageSellOffer(offer))
                    .setTimeout(60)
                    .build();
                transaction.sign(StellarSdk.Keypair.fromSecret(namespace.Core.currentAccount.keys.secret()));
                return stellarServer.submitTransaction(transaction);
            })
            .then(function (result) {
                cb(true, result);
            })
            .catch(function (error) {
                cb(false, error);
                console.error(error);
            });
    };

    // Cancel offer.
    namespace.Core.StellarNetwork.prototype.cancelOffer = function (offer, cb) {

        stellarServer.loadAccount(namespace.Core.currentAccount.keys.publicKey())
            .then(function (receiver) {
                const transaction = new StellarSdk.TransactionBuilder(receiver, { "fee": StellarSdk.BASE_FEE, "networkPassphrase": networkPassphrase })
                    .addOperation(StellarSdk.Operation.manageSellOffer({
                        selling: offer.baseAsset,
                        buying: offer.quoteAsset,
                        amount: "0",
                        price: offer.price,
                        offerId: offer.id
                    }))
                    .setTimeout(60)
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

    // Get order book for pair.
    namespace.Core.StellarNetwork.prototype.getOrderBook = function (base, quote, history, cb) {
        stellarServer.orderbook(base, quote)
            .call()
            .then((resp) => {

                const isMyBid = (entry) => {
                    if (namespace.Core.currentAccount.offers) {
                        return namespace.Core.currentAccount.offers.some((offer) => {
                            return offer.quoteAsset.code === base.code
                                && offer.quoteAsset.issuer === base.issuer
                                && offer.baseAsset.code === quote.code
                                && offer.baseAsset.issuer === quote.issuer
                                && offer.price.d === entry.price_r.n
                                && offer.price.n === entry.price_r.d
                        });
                    }
                    return false;
                };

                const isMyAsk = (entry) => {
                    if (namespace.Core.currentAccount.offers) {
                        return namespace.Core.currentAccount.offers.some((offer) => {
                            return offer.baseAsset.code === base.code
                                && offer.baseAsset.issuer === base.issuer
                                && offer.quoteAsset.code === quote.code
                                && offer.quoteAsset.issuer === quote.issuer
                                && offer.price.n === entry.price_r.n
                                && offer.price.d === entry.price_r.d
                        });
                    }
                    return false;
                };

                let orderBook = { "bids": [], "asks": [], "history": history };
                if (resp.bids) {
                    for (let i = 0; i < resp.bids.length; i += 1) {
                        orderBook.bids.push(
                            {
                                "price": { "n": resp.bids[i].price_r.n, "d": resp.bids[i].price_r.d },
                                "baseAmount": (Number(resp.bids[i].amount) / (resp.bids[i].price_r.n / resp.bids[i].price_r.d)).toFixed(7),
                                "quoteAmount": resp.bids[i].amount,
                                "isMine": isMyBid(resp.bids[i])
                            }
                        );
                    }
                }

                if (resp.asks) {
                    for (let i = 0; i < resp.asks.length; i += 1) {
                        orderBook.asks.push(
                            {
                                "price": { "n": resp.asks[i].price_r.n, "d": resp.asks[i].price_r.d },
                                "baseAmount": resp.asks[i].amount,
                                "quoteAmount": (Number(resp.asks[i].amount) * (resp.asks[i].price_r.n / resp.asks[i].price_r.d)).toFixed(7),
                                "isMine": isMyAsk(resp.asks[i])
                            }
                        );
                    }
                }

                // Query trade history (without waiting for reply).
                stellarServer.trades()
                    .forAssetPair(base, quote)
                    .limit(namespace.config.maxOrders)
                    .order("desc")
                    .call()
                    .then((resp) => {
                        orderBook.history = [];
                        for (let i = 0; i < resp.records.length; i += 1) {
                            const record = resp.records[i];
                            orderBook.history.push(
                                {
                                    "baseAmount": record.base_amount,
                                    "price": { "n": record.price.n, "d": record.price.d },
                                    "quoteAmount": record.counter_amount,
                                    "time": new Date(record.ledger_close_time),
                                    "baseAccount": record.base_account,
                                    "quoteAccount": record.counter_account,
                                    "id": record.id,
                                    "isBuy": record.base_is_seller
                                });
                        }
                    })
                    .catch((err) => {
                        console.error(err);
                    });

                cb(false, orderBook);
            })
            .catch((err) => {
                console.error(err);
                cb(true, err);
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
    namespace.Core.Asset = function (issuer, code, balance, loadedCb) {
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
            this.nftVerified = true;
            if (loadedCb) {
                loadedCb();
            }
        }
        else {
            const stellarNet = new namespace.Core.StellarNetwork();
            stellarNet.loadIssuerAccount(this.issuer).then((result) => {

                // Verify that the issuer fulfills the terms of an NFT contract.
                stellarNet.verifyNFTContract(
                    this.code, 
                    this.issuer,
                    result,
                    (contract, error) => {
                        if (contract && contract.valid) {
                            this.nftContract = contract;
                        }
                        this.nftVerified = true;
                    });

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
                                            if (loadedCb) {
                                                loadedCb();
                                            }
                                        };
                                        this.image.onerror = () => {
                                            this.validImage = false;
                                            this.image = null;
                                            this.loaded = true;
                                            if (loadedCb) {
                                                loadedCb();
                                            }
                                        };
                                        this.image.src = currency.image;
                                    }
                                    else {
                                        this.loaded = true;
                                        if (loadedCb) {
                                            loadedCb();
                                        }
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
                                if (loadedCb) {
                                    loadedCb();
                                }
                            }
                        })
                        .catch(error => {
                            console.error(JSON.stringify(error));
                            // Unverified home domain (no toml).
                            this.name = this.code;
                            this.loaded = true;
                            if (loadedCb) {
                                loadedCb();
                            }
                        });
                }
                else {
                    // Unverified - no home domain.
                    this.name = this.code;
                    this.loaded = true;
                    if (loadedCb) {
                        loadedCb();
                    }
                }
            }).catch((error) => {
                console.error(JSON.stringify(error));
                // Invalid account and unverified asset.
                this.name = this.code;
                this.errored = true;
                this.loaded = true;
                if (loadedCb) {
                    loadedCb();
                }
            });
        }
    };
})(window.Litemint = window.Litemint || {});
