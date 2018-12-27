/**
 * @overview Litemint Spear index.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

// Litemint core customization.
(function (namespace) {

    // Replace local core storage with in-memory storage.
    // so account data do not get stored in the browser local storage.
    const transientStorage = {
        "map": {},
        "setItem": function (key, value) {
            return this.map[key] = value;
        },
        "getItem": function (key) {
            return this.map.hasOwnProperty(key) ? this.map[key] : null;
        }
    };

    namespace.Core.getData = function (location) {
        return transientStorage.getItem(location);
    };

    namespace.Core.setData = function (location, data) {
        transientStorage.setItem(location, data);
    };

    namespace.Core.wipeStorage = function () {
        transientStorage.map = {};
    };

    namespace.Core.KeyTool.prototype.keyFromPin = function (key) {
        // On Spear we do not need to use PBKDF2
        // as the key is randomly generated and never re-used across sessions.
        return namespace.Core.Utils.hexToBytes(key);
    };
})(window.Litemint = window.Litemint || {});

// Spear.
(function (namespace) {

    const hasStorage = typeof window.localStorage !== "undefined";

    namespace.SignInErrorType = {
        "None": 0,
        "AccountNotCreated": 1,
        "AccountNotAvailable": 2
    };

    let retryId = 0;
    let signInError = namespace.SignInErrorType.None;

    // This secret is used to encrypt the transient storage. Paranoid?
    namespace.secret = Litemint.Core.Utils.getRandomBytes(16);

    namespace.defaultAsset = new Litemint.Core.Asset("native", "XLM", "0");

    namespace.setLang = function (lang) {
        if (hasStorage) {
            window.localStorage.setItem("litemint-language", lang);
        }
    };

    namespace.getLang = function () {
        const def = namespace.defaultLanguage;
        if (!hasStorage) {
            return def;
        }
        return window.localStorage.getItem("litemint-language")
            || namespace.defaultLanguage;
    };

    namespace.updateLanguage = function (lang) {
        namespace.setLang(lang);
        $("#sign-out-label").html(namespace.languagePacks[lang].text[0]);
        $("#sign-in-instructions").html(namespace.languagePacks[lang].text[1]);
        $("#sign-in-error-text").html(namespace.languagePacks[lang].text[2]);
        $("#account-data").attr("placeholder", namespace.languagePacks[lang].text[3]);
        $("#load-account").html(namespace.languagePacks[lang].text[4]);
        $("#create-account").html(namespace.languagePacks[lang].text[5]);
        $("#security-warning-title").html(namespace.languagePacks[lang].text[6]);
        $("#security-warning").html(namespace.languagePacks[lang].text[7]);
        $("#assets-tab-label").html(namespace.languagePacks[lang].text[8]);
        $("#activity-tab-label").html(namespace.languagePacks[lang].text[9]);
        $("#account-tab-label").html(namespace.languagePacks[lang].text[10]);
        $(".send-label").html(namespace.languagePacks[lang].text[11]);
        $(".receive-label").html(namespace.languagePacks[lang].text[12]);
        $(".trade-label").html(namespace.languagePacks[lang].text[13]);
        $(".balance-label").html(namespace.languagePacks[lang].text[14]);
        $(".addasset-label").html(namespace.languagePacks[lang].text[15]);
        $(".verified-tooltip").attr("data-tooltip", namespace.languagePacks[lang].text[17]);
        $(".verified-image").attr("alt", namespace.languagePacks[lang].text[17]);
    };

    namespace.loadWalletData = function () {
        let data = {
            "accounts": [],
            "lastaccount": -1
        };

        let currData = Litemint.Core.getData(Litemint.config.storageId);
        if (currData) {
            data = JSON.parse(currData);
        }
        return data;
    };

    namespace.saveWalletData = function (data) {
        Litemint.Core.setData(Litemint.config.storageId, JSON.stringify(data));
    };

    namespace.formatPrice = function (price, decimals) {
        return Number(price).toFixed(decimals || 7);
    };

    function signIn(cb) {
        const stellarNet = new Litemint.Core.StellarNetwork();
        let timeoutId = 0;
        let firstUpdate = true;

        function reloadAccount(indexes) {
            function compare(a, b) {
                const ca1 = a.balance ? 0 : 1;
                const ca2 = b.balance ? 0 : 1;
                const cb1 = Number(a.balance) ? 0 : 1;
                const cb2 = Number(b.balance) ? 0 : 1;
                const cc1 = a.name;
                const cc2 = b.name;
                if (ca1 < ca2) return -1;
                if (ca1 > ca2) return 1;
                if (cb1 < cb2) return -1;
                if (cb1 > cb2) return 1;
                if (cc1 < cc2) return -1;
                if (cc1 > cc2) return 1;
                return 0;
            }

            let items = [];

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            for (let i = 0; i < Litemint.Core.currentAccount.assets.length; i += 1) {
                items.push(Litemint.Core.currentAccount.assets[i]);
            }

            if (Litemint.Core.currentAccount.assets.length === 0) {
                items.push(namespace.defaultAsset);
            }

            items.sort(compare);

            let loadingAssets = [];
            let columns = "<div class='is-centered has-text-centered'><button class='button is-primary'><span class='icon is-medium'><i class='fas fa-plus'></i></span><span class='addasset-label'></span></button></div><br />";

            for (let i = 0; i < items.length;) {
                let item = items[i];
                if (!(i % 2)) {
                    columns += "<div class='columns'>";
                }

                loadingAssets.push(item);

                columns += "<div class='column is-6'>";
                columns += "<div class='card'>" +
                                "<div class='card-image'>" +
                                    "<div class='has-text-centered notification is-radiusless'>" +
                                        "<p class='balance-label'></p>" +
                                        "<p id= '" + item.code + "_" + item.issuer + "_balance" + "' class='has-text-weight-bold is-size-4'></p>" +
                                    "</div>" +
                                "</div>" +
                                "<div class='card-content'>" +
                                "<div id= '" + item.code + "_" + item.issuer + "_content" + "' class='media'>" +
                                    "</div>" +
                                "</div>";
                columns += "<footer class='card-footer'>" +
                                "<a class='card-footer-item is-clipped'>" +
                                    "<img class='image is-32x32' src='res/img/send.png' />" +
                                    "<span class='send-label'></span>" +
                                "</a>" +
                                "<a class='card-footer-item is-clipped'>" +
                                    "<img class='image is-32x32' src='res/img/receive.png' />" +
                                    "<span class='receive-label'></span>" +
                                "</a>" +
                                "<a class='card-footer-item is-clipped'>" +
                                    "<img class='image is-32x32' src='res/img/trade.png' />" +
                                    "<span class='trade-label'></span>" +
                                "</a>" +
                            "</footer>";
                columns += "</div></div>";

                i += 1;
                if (!(i % 2) || i === items.length) {
                    columns += "</div>";
                    $("#assets").html(columns);
                }
            }

            function updateContent() {
                let newItemsAdded = false;
                for (let i = 0; i < loadingAssets.length;) {
                    if (loadingAssets[i].loaded) {
                        $("#" + loadingAssets[i].code + "_" + loadingAssets[i].issuer + "_content").html(
                            "<div class='media-left'>" +
                            "<figure class='image is-64x64'>" +
                            "<img src='" + (loadingAssets[i].image ? loadingAssets[i].image.src : "res/img/stellar.png") + "' />" +
                            "</figure>" +
                            "</div>" +
                            "<div class='media-content'>" +
                            "<span class='title is-6'>" + loadingAssets[i].name + "</span><br />" +
                            "<a href='https://" + loadingAssets[i].domain + "' class='has-text-link subtitle is-6'>" + loadingAssets[i].domain + "</a>" +
                            "</div>" +
                            "<div class='verified-tooltip media-right is-pulled-right has-text-centered tooltip' data-tooltip=''>" +
                            "<img class='image is-32x32' src='res/img/shield.png' alt='' />" +
                            "</div>"
                        );
                        $("#" + loadingAssets[i].code + "_" + loadingAssets[i].issuer + "_balance").html(
                            loadingAssets[i].code + " " + namespace.formatPrice(loadingAssets[i].balance, loadingAssets[i].decimals)
                        );
                        loadingAssets.splice(i, 1);
                        newItemsAdded = true;
                    }
                    else {
                        i += 1;
                    }
                }
                if (loadingAssets.length) {
                    timeoutId = setTimeout(updateContent, 500);
                }

                if (newItemsAdded) {
                    namespace.updateLanguage($("#language-select").val());
                }
            }
            timeoutId = setTimeout(updateContent, 500);
        }

        function refreshAccount() {
            let items = [];
            for (let i = 0; i < Litemint.Core.currentAccount.assets.length; i += 1) {
                const item = Litemint.Core.currentAccount.assets[i];
                $("#" + item.code + "_" + item.issuer + "_balance").html(
                    item.code + " " + namespace.formatPrice(item.balance, item.decimals)
                );
            }
        }

        stellarNet.loadDefaultAssets();
        stellarNet.attachAccount((full, indexes) => {
            stellarNet.updateAccount(full && !firstUpdate).then((account) => {
                if (!full || firstUpdate) {
                    firstUpdate = false;
                    refreshAccount();
                }
                else {
                    reloadAccount(indexes);
                }
            });
        }).then(function () {
                reloadAccount();
                $("#sign-out").removeClass("is-hidden");
                if (cb) {
                    cb();
                }
            }).catch(function (err) {
                reloadAccount();
                $("#sign-out").removeClass("is-hidden");
                if (cb) {
                    cb(err);
                }
        });
    }

    function handleSignInError(error) {
        if (error) {
            if (Litemint.Core.currentAccount.keys) {
                if (error.response && error.response.status === 404) {
                    signInError = namespace.SignInErrorType.AccountNotCreated;
                    // Install a watch on the account to get notified of creation.
                    const stellarNet = new Litemint.Core.StellarNetwork();
                    stellarNet.watchAccount(Litemint.Core.currentAccount.keys.publicKey(),
                        () => {
                            signIn((error) => {
                                handleSignInError(error);
                            });
                        }
                    );
                }
                else {
                    signInError = namespace.SignInErrorType.AccountNotAvailable;
                    // Retry every 10 seconds.
                    retryId = setTimeout(() => {
                        signIn((error) => {
                            handleSignInError(error);
                        });
                    }, 10000);
                }
            }
        }
    }

    function signOutCb() {
        if (retryId) {
            clearTimeout(retryId);
        }
        new Litemint.Core.StellarNetwork().detachAccount();
        namespace.loadSection($("#sign-in"));
    }

    $("#create-account").click(() => {
        $("#account-data").val("");

        namespace.loadSection();
        setTimeout(() => {
            Litemint.Core.currentAccount.create(
                namespace.secret, "new_account",
                false, {
                    "load": namespace.loadWalletData,
                    "save": namespace.saveWalletData
                });

            signIn((error) => {
                namespace.loadSection($("#dashboard"));
                handleSignInError(error);
            });
        }, 500);
    });

    $("#load-account").click(() => {
        function setError(active) {
            if (active) {
                $("#account-data").trigger("focus");
                $("#account-data").removeClass("is-info");
                $("#account-data").addClass("is-danger");
                $("#sign-in-error").removeClass("is-hidden");
            }
            else {
                $("#account-data").removeClass("is-danger");
                $("#account-data").addClass("is-info");
                $("#sign-in-error").addClass("is-hidden");
            }
        }
        $("#account-data").on("input", function () {
            setError(false);
        });
        const accountData = $("#account-data").val();
        $("#account-data").val("");
        if (accountData === "") {
            setError(true);
        }
        else {
            if (new Litemint.Core.Account().getPublicFromMnemonic(accountData)
                || StellarSdk.StrKey.isValidEd25519PublicKey(accountData)
                || StellarSdk.StrKey.isValidEd25519SecretSeed(accountData)) {
                namespace.loadSection();
                setTimeout(() => {
                    Litemint.Core.currentAccount.create(
                        namespace.secret, "new_account",
                        false, {
                            "load": namespace.loadWalletData,
                            "save": namespace.saveWalletData
                        }, accountData);

                    signIn((error) => {
                        namespace.loadSection($("#dashboard"));
                        handleSignInError(error);
                    });
                }, 500);
            }
            else {
                setError(true);
            }
        }
    });

    $("#sign-out").click(() => {
        namespace.loadSection();
        Litemint.Core.wipeStorage();
        $("#sign-out").addClass("is-hidden");
        setTimeout(() => {
            Litemint.Core.currentAccount.unload(signOutCb);
        }, 500);
    });

    $("#language-select").change(function () {
        namespace.updateLanguage($("#language-select").val());
    });

    namespace.loadSection = function (element) {
        const el = element || $("#loader");
        if (el.is(":hidden")) {
            $(".spear-page").hide();
            $(".spear-page").removeClass("is-hidden");
            el.fadeIn();
        }
    };

    $(document).ready(function () {
        $(window).scroll(function () {
            var pos = $(window).scrollTop();
            if (pos === 0) {
                $(".navbar").removeClass('site-navbar-scrolled');
            }
            else {
                $(".navbar").addClass('site-navbar-scrolled');
            }
        });

        // Initialize the language.
        const currLang = namespace.getLang();
        namespace.updateLanguage(currLang);
        for (let lang in namespace.languagePacks) {
            if (namespace.languagePacks.hasOwnProperty(lang)) {
                const pack = namespace.languagePacks[lang];
                $("#language-select").append(new Option(pack.name, lang, currLang === lang, currLang === lang));
            }
        }

        // Load the sign in page.
        namespace.loadSection($("#sign-in"));
    });

})(window.Litemint.Spear = window.Litemint.Spear || {});
