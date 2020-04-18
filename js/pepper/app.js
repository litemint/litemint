/**
 * @overview Litemint Pepper App implementation.
 * @copyright 2018-2020 Frederic Rezeau, aka 오경진.
 * @copyright 2018-2020 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

"use strict";

(function (namespace) {
    let canvas,
        context,
        lastTime,
        view,
        isPointerDown,
        loadingstate,
        pixelRatio,
        loaderAngle,
        loaded,
        showLoader,
        loaderTime,
        loaderText,
        fontTrigger,
        readyTrigger,
        retryId,
        rotateScreen,
        timeoutAssetPage;

    /**
     * Initialize litemint core and view.
     * @function initialize
     * @memberof Litemint
     */
    namespace.initialize = function () {
        canvas = document.getElementById("mainview");
        context = canvas.getContext("2d");

        pixelRatio = getPixelRatio(context);

        $("#mainview").bind("vmousedown", pointerDown);
        $("#mainview").bind("vmouseup", pointerUp);
        $("#mainview").bind("vmousemove", pointerMove);

        namespace.Pepper.resetDisplay(canvas);

        if (window.Android) {
            window.onBarHeightChange = function (height) {
                namespace.Pepper.barHeight = parseInt(height);
            };
            window.Android.getBarHeight();
        }

        namespace.Pepper.Resources.logoImage = new Image();
        namespace.Pepper.Resources.logoImage.onload = onStart;
        namespace.Pepper.Resources.logoImage.src = "res/img/logosmall.png";

        // Download and refresh market data rates periodically.
        namespace.Pepper.MarketData.rates = {};
        const getRates = function () {
            $.ajax(namespace.config.apiUrl + "/.market/getrates").then(
                function success(response) {
                    namespace.Pepper.MarketData.rates = response;
                },
                function fail(data, status) {
                    console.error("Failed to get market rates: " + status);
                }
            );
        };
        getRates();
        setInterval(() => {
            getRates();
        }, 1000 * 60 * namespace.config.marketDataInterval);

        // Periodically refresh the current orderbook.
        namespace.Pepper.orderBooks = {"skipCount" : 0, "oldBook": "" };
        setInterval(() => {
            if (view && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Trade) {
                const base = view.getActiveCarouselItem().asset;
                if (base) {
                    const quote = view.quoteAssets[base.code + base.issuer];
                    if (quote && (quote.code !== base.code || quote.issuer !== base.issuer)) {
                        namespace.Pepper.orderBooks.skipCount += 1;
                        let propId = base.code + base.issuer + quote.code + quote.issuer;
                        if (namespace.Pepper.orderBooks.skipCount > 2
                            || namespace.Pepper.orderBooks.oldBook !== propId) {

                            const stellarnetwork = new namespace.Core.StellarNetwork();
                            const baseAsset = base.issuer === "native" ? StellarSdk.Asset.native() : new StellarSdk.Asset(base.code, base.issuer);
                            const quoteAsset = quote.issuer === "native" ? StellarSdk.Asset.native() : new StellarSdk.Asset(quote.code, quote.issuer);

                            namespace.Pepper.orderBooks.oldBook = propId;
                            namespace.Pepper.orderBooks.skipCount = 0;

                            // Preserve the history.
                            let history = namespace.Pepper.orderBooks[propId] ? namespace.Pepper.orderBooks[propId].history : null;

                            stellarnetwork.getOrderBook(baseAsset, quoteAsset, history, (err, book) => {
                                if (!err) {
                                    let newBook = namespace.Pepper.orderBooks[propId] ? false : true;
                                    namespace.Pepper.orderBooks[propId] = book;
                                    console.log(namespace.Pepper.orderBooks[propId]);
                                    loadOrderBook(newBook);
                                }
                            });
                        }
                    }
                    else {
                        view.resetBook();
                        view.book.items = [];
                        view.needRedraw = true;
                    }
                }
            }
        }, 1000 * namespace.config.marketDataInterval);

        setInterval(() => {
            retrieveLeaderboard();
        }, 1000 * 5 * namespace.config.marketDataInterval);

        // Download the store data.
        namespace.Pepper.storeData = [];
        namespace.Pepper.storeDataCache = [];
        const getStoreData = function () {
            const loadStoreItem = function (item) {
                if (!item.desktopOnly || item.desktopOnly && namespace.Pepper.isDesktop) {
                    const storeItem = {};
                    storeItem.image = new Image();
                    storeItem.image.onload = () => {
                        storeItem.valid = true;
                    };
                    storeItem.image.onerror = () => {
                        storeItem.valid = false;
                    };
                    storeItem.image.src = item.imageLink;

                    if (item.headerLink) {
                        storeItem.headerImage = new Image();
                        storeItem.headerImage.onload = () => {
                            storeItem.validHeader = true;
                        };
                        storeItem.headerImage.onerror = () => {
                            storeItem.validHeader = false;
                        };
                        storeItem.headerImage.src = item.headerLink;
                    }

                    storeItem.data = item;
                    namespace.Pepper.storeDataCache.push(storeItem);
                }
            };

            $.ajax(namespace.config.apiUrl + "/.store/getdata").then(
                function success(response) {
                    namespace.Pepper.storeDataCache = [];
                    for (let i = 0; i < response.length; i += 1) {
                        loadStoreItem(response[i]);
                    }
                },
                function fail(data, status) {
                }
            );
        };

        getStoreData();
        setInterval(() => {
            // Re-query the store data every 10 minutes.            
            getStoreData();
        }, 1000 * 60 * 10);

        // Download the network message.
        namespace.Pepper.networkMessage = namespace.config.version;
        const getmessage = function () {
            $.ajax(namespace.config.apiUrl + "/.tools/getmessage").then(
                function success(response) {
                    if (response !== "") {
                        namespace.Pepper.networkMessage = response;
                    }
                },
                function fail(data, status) {
                    console.error("Failed to get the network message: " + status);
                }
            );
        };
        getmessage();

        // Download the sponsors data.
        namespace.Pepper.Resources.sponsors = [];
        const getSponsors = function () {
            const loadImage = function (index) {
                const sponsor = namespace.Pepper.Resources.sponsors[index];
                sponsor.image = new Image();
                sponsor.image.onload = () => {
                    sponsor.valid = true;
                };
                sponsor.image.onerror = () => {
                    sponsor.valid = false;
                };
                sponsor.image.src = sponsor.imageLink;
            };

            $.ajax(namespace.config.apiUrl + "/.tools/getsponsors").then(
                function success(response) {
                    namespace.Pepper.Resources.sponsors = response;
                    for (let i = 0; i < namespace.Pepper.Resources.sponsors.length; i += 1) {
                        loadImage(i);
                    }
                    if (namespace.Pepper.Resources.sponsors.length) {
                        namespace.Pepper.Resources.currentSponsor = namespace.Pepper.Resources.sponsors[0];
                    }
                },
                function fail(data, status) {
                    console.error("Failed to get sponsors: " + status);
                }
            );
        };
        getSponsors();

        namespace.Pepper.coinSwitch = {};

        Chart.defaults.global.defaultFontFamily = 'Roboto-Regular';
        Chart.defaults.global.defaultFontColor = "rgb(118, 231, 214)";

        namespace.Core.currentAccount.unload(signOutCb);

        setInterval(() => {
            if (namespace.Core.currentAccount.notifications.length) {
                let notification = namespace.Core.currentAccount.notifications[0];
                namespace.Core.currentAccount.notifications.splice(0, 1);
                let message = namespace.Pepper.Resources.localeText[153] + notification.amount + " " + notification.code;
                if (window.Android) {
                    if (view.account) {
                        if (!view.account.notoast) {
                            window.Android.showToast(message);
                        }

                        if (!view.account.nonotif) {
                            window.Android.showNotification(message);
                        }
                    }
                }
                else if (namespace.Pepper.isWebkitHost()) {
                    if (view.account) {
                        if (!view.account.notoast) {
                            webkit.messageHandlers.callbackHandler.postMessage({ "name": "showToast", "message": message });
                        }
                        if (!view.account.nonotif) {
                            webkit.messageHandlers.callbackHandler.postMessage({ "name": "showNotification", "message": message });
                        }
                    }
                }
                else if (parent) {
                    if (view.account) {
                        if (!view.account.notoast) {
                            parent.postMessage("litemint_toast:" + message, "*");
                        }

                        // TODO
                        //if (!view.account.nonotif) {
                        //}
                    }
                }
            }
        }, 1000);

        loaderAngle = 0;

        runApp();
    };

    /**
     * Reset the display buffer, canvas and the view.
     * @function resetDisplay
     * @memberof Litemint.Pepper
     */
    namespace.Pepper.resetDisplay = function () {
        if (canvas) {
            if (namespace.Pepper.isDesktop) {
                const height = $(window).height();
                canvas.height = height * pixelRatio;
                canvas.width = canvas.height * 0.5;
                canvas.style.height = height + "px";
                canvas.style.width = canvas.style.height * 0.5 + "px";
            }
            else {
                canvas.width = $(window).width() * pixelRatio;
                canvas.height = $(window).height() * pixelRatio;
                canvas.style.width = $(window).width() + "px";
                canvas.style.height = $(window).height() + "px";
            }

            canvas.getContext("2d").setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            if (view) {
                view.needRedraw = true;
                view.resize(canvas.width, canvas.height);
                Chart.defaults.global.defaultFontSize = view.baseFontSize * 0.85 / pixelRatio;
                draw();

                if(view && view.appId){
                    const heightInPercent = ($(document).height() - namespace.Pepper.barHeight / pixelRatio) * 100 / $(document).height();
                    $("#activity-view").css("height", heightInPercent + "%");
                }
            }
            // Minimum supported ratio for mobile = 0.87 * 4 / 3
            rotateScreen = canvas.width * 1.16 > canvas.height ? true : false;
        }
    };

    /**
     * Handle back button pressed for mobile.
     * @function onBackButtonPressed
     * @memberof Litemint.Pepper
     * @return {String} "exit" or "stay"
     */
    namespace.Pepper.onBackButtonPressed = function () {
        // Don't quit the app just yet.
        if (!view || (rotateScreen && !view.appId) || showLoader ||
            view.scrollerTime || view.scrollerEndTime || view.showPinLoader
            || view.modalPageEndTime) {
            return "stay";
        }

        view.needRedraw = true;
        
        if (view.appId) {
            domShowApp(false);
            // Request and ad from native layer.
            if (!namespace.config.disableAds) {
                if (window.Android) {
                    if (window.Android.showAd) {
                        window.Android.showAd();
                    }
                }
            }
            return "stay";
        }
        else if (view.showModalPage) {
            // Close the modal page if opened.
            domShowVerificationForm(false);
            domShowImportForm(false);
            domShowAssetPage(false);
            domShowModalPage(false, namespace.Pepper.WizardType.None, true);
            return "stay";
        }
        else if (view.showScroller) {
            domShowDomainForm(false);
            domShowRenameForm(false);
            view.scrollerEndTime = 0.3;

            if (view.scroller.type === namespace.Pepper.ScrollerType.QuotesMenu
                || view.scroller.type === namespace.Pepper.ScrollerType.Assets) {
                if (view.isActivityMode) {
                    if (view.activityType === namespace.Pepper.ActivityType.Trade) {
                        domShowTradeForm(true);
                    }
                }
            }

            return "stay";
        }
        else if (view.showAbout) {
            domShowAboutPage(false);
            return "stay";
        }
        else if (view.isActivityMode) {
            if (view.activityType === namespace.Pepper.ActivityType.Exchange && view.selectedGameShop) {
                view.selectedGameShop = null;
                view.shopTime = 0.3;
            }
            else {
                view.closeSendPage(() => {
                    domShowAddressForm(false);
                    domShowTradeForm(false);
                });
            }
            return "stay";
        }
        else if (view.isDashboardMenu) {
            view.isDashboardMenu = false;
            return "stay";
        }
        else if (view.isPinMenu) {
            view.isPinMenu = false;
            return "stay";
        }

        // Can safely exit the app.
        return "exit";
    };

    namespace.Pepper.onScroll = function (down) {

        if (rotateScreen || !view || showLoader ||
            view.scrollerTime || view.scrollerEndTime || view.showPinLoader
            || view.modalPageEndTime) {
            return;
        }

        if (view.showScroller) {
            if (down && view.scroller.offset < view.scroller.maxOffset) {
                view.scroller.offset += view.unit;
            }
            else if (!down && view.scroller.offset > 0) {
                view.scroller.offset -= view.unit;
            }
        }
        else if (view.isActivityMode && !view.isDashboardMenu && !view.isPinMenu && !view.showAbout && view.activityType === namespace.Pepper.ActivityType.Trade) {
            if (down && view.book.offset < view.book.maxOffset) {
                view.book.offset += view.unit;
            }
            else if (!down && view.book.offset > 0) {
                view.book.offset -= view.unit;
            }
        }
        else if (view.isActivityMode && !view.isDashboardMenu && !view.isPinMenu && !view.showAbout && view.activityType === namespace.Pepper.ActivityType.Exchange) {
            if (view.selectedGameShop) {
                if (down && view.shop.offset < view.shop.maxOffset) {
                    view.shop.offset += view.unit;
                }
                else if (!down && view.shop.offset > 0) {
                    view.shop.offset -= view.unit;
                }
            }
            else {
                if (down && view.store.offset < view.store.maxOffset) {
                    view.store.offset += view.unit;
                }
                else if (!down && view.store.offset > 0) {
                    view.store.offset -= view.unit;
                }
            }
        }
        else if (!view.isActivityMode && !view.isDashboardMenu && !view.isPinMenu && !view.showAbout) {
            if (down && view.list.offset < view.list.maxOffset) {
                view.list.offset += view.unit;
            }
            else if (!down && view.list.offset > 0) {
                view.list.offset -= view.unit;
            }
        }
        view.needRedraw = true;
    };

    namespace.Pepper.isWebkitHost = function () {
        return typeof window.webkit !== "undefined" && webkit.messageHandlers && webkit.messageHandlers.callbackHandler;
    };

    function onLoad(current, total) {
        loadingstate = { "current": current, "total": total };
        if (!readyTrigger) {
            readyTrigger = true;
            if (window.Android) {
                window.Android.setReady();
            }
            else if (namespace.Pepper.isWebkitHost()) {
                webkit.messageHandlers.callbackHandler.postMessage({ "name": "ready" });
            }
            else if (parent) {
                parent.postMessage("litemint_ready", "*");
            }
        }
    }

    function onLoaded(images) {
        for (let image in images) {
            if (images.hasOwnProperty(image)) {
                namespace.Pepper.Resources[image] = images[image];
            }
        }

        const data = namespace.Pepper.loadWalletData();
        view = new namespace.Pepper.View(data.lastaccount === -1 ? true : false);
        view.load(canvas.width, canvas.height,
            data.languageId,
            () => {
                loaded = true;
                domUpdateLanguage();
                domShowAboutPage(false);
                updateTradeInputs();
                view.onCarouselItemChanged = function () {
                    domGenerateCode();
                    loadOrderBook(true);
                };
            });
    }

    function onStart() {
        let manifest = [];
        for (let imageId in namespace.Pepper.Resources.imageFiles) {
            if (namespace.Pepper.Resources.imageFiles.hasOwnProperty(imageId)) {
                manifest.push({ "id": imageId, "src": "res/img/" + namespace.Pepper.Resources.imageFiles[imageId] });
            }
        }
        namespace.Pepper.Tools.loadResources(manifest, onLoaded, onLoad);
    }

    function update(elapsed) {
        if (!rotateScreen) {
            if (!showLoader && loaded && view) {
                domUpdate();
                view.update(elapsed);
            }
            else {
                if (loaderTime > 0) {
                    loaderTime -= elapsed;
                    if (loaderTime < 0) {
                        loaderTime = 0;
                    }

                    if (view) {
                        view.needRedraw = true;
                    }
                }

                loaderAngle = (loaderAngle + Math.PI * 1.5 * elapsed) % (Math.PI * 2);
            }
        }
    }

    function draw() {
        if (!rotateScreen) {
            if (!showLoader && loaded && view) {
                view.draw(context);
            }
            else {
                let x = canvas.width * 0.5;
                let y = canvas.height * 0.5;
                let w = Math.min(canvas.width, canvas.height) * 0.2;
                context.save();
                context.fillStyle = namespace.Pepper.Resources.primaryColor;
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(namespace.Pepper.Resources.logoImage, x - w * 0.5, y - w * 0.5, w, w);
                if (!loaded) {
                    loaderText = loadingstate ? Math.min(100, loadingstate.current).toString() + "%" : "0%";
                }
                context.restore();
                if (loaderText) {
                    const fontSize = !loaded ? 22 * pixelRatio : 17 * pixelRatio;
                    context.textAlign = "center";
                    context.textBaseline = "middle";
                    context.font = fontSize + "px Roboto-Regular";
                    context.fillStyle = "rgb(255, 255, 255)";
                    context.fillText(loaderText, x, y + w * 0.5 + w * 0.22);

                    if (!loaded) {
                        loaderText = null;
                    }
                }
            }

            if (!fontTrigger) {
                fontTrigger = true;
                context.font = "1px Roboto-Regular";
                context.fillText("M", 0, 0);
                context.font = "1px Roboto-Bold";
                context.fillText("M", 0, 0);
                context.fillStyle = "rgba(36, 41, 46, 0)";
                context.font = "1px Roboto-Thin";
                context.fillText("M", 0, 0);
                context.font = "1px Roboto-Light";
                context.fillText("M", 0, 0);
                context.font = "1px Roboto-Medium";
                context.fillText("M", 0, 0);
                context.font = "1px Roboto-Black";
                context.fillText("M", 0, 0);
            }
        }
        else {
            if (namespace.Pepper.Resources.rotateImage) {
                let x = canvas.width * 0.5;
                let y = canvas.height * 0.5;
                let w = Math.min(canvas.width, canvas.height) * 0.2;
                context.drawImage(namespace.Pepper.Resources.rotateImage, x - w * 0.5, y - w * 0.5, w, w);
            }
        }
    }

    function runApp() {
        const now = new Date().getTime(),
            elapsed = Math.min((now - (lastTime || now)) / 1000, 0.05);
        lastTime = now;

        window.requestAnimationFrame(runApp);

        if (!loaded || showLoader || view && view.needRedraw) {
            if (view) {
                view.needRedraw = false;
            }

            update(elapsed);

            // Reset the context to identity matrix.
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            draw();
        }
    }

    function getPixelRatio (context) {
        const dpr = window.devicePixelRatio || 1,
            bsr = context.webkitBackingStorePixelRatio ||
            context.mozBackingStorePixelRatio ||
            context.msBackingStorePixelRatio ||
            context.oBackingStorePixelRatio ||
            context.backingStorePixelRatio || 1;
        return dpr / bsr;
    }

    function testScroller(testType, point, scroller, isDown, callback) {
        let selected = false;
        for (let i = 0; i < scroller.items.length; i += 1) {
            const item = scroller.items[i];
            let hasChallenge = (view.scroller.type === namespace.Pepper.ScrollerType.Leaderboard && view.selectedGame && view.selectedGame.data && view.selectedGame.data.challenge) ? true : false;
            let canSelect = true;
            let offset = hasChallenge && i <= 2 ? 0 : view.scroller.offset;
            if (hasChallenge && i > 2 && point.y < view.scroller.y + item.height * 3) {
                canSelect = false;
            }

            switch (testType) {
                case 0:
                    item.selected = false;
                    item.hover = false;
                    item.overAddBtn = false;
                    if (canSelect && point.y < view.scroller.y + view.scroller.height) {
                        if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y - offset, item.x + item.width, item.y + item.height - offset)) {
                            item.selected = true;
                            selected = true;

                            if (view.scroller.type === namespace.Pepper.ScrollerType.AddAsset && !namespace.Pepper.queryAsset) {
                                if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 1.7, item.y + view.unit * 0.25 - offset, item.x + view.unit * 1.7 + view.unit * 2.4, item.y + view.unit * 0.25 - offset + view.unit * 0.7)) {
                                    item.overAddBtn = true;
                                }
                            }
                        }

                        if ((view.scroller.type === namespace.Pepper.ScrollerType.LiveOrders
                            || view.scroller.type === namespace.Pepper.ScrollerType.CoinSwap
                            || view.scroller.type === namespace.Pepper.ScrollerType.LastTrades
                            || view.scroller.type === namespace.Pepper.ScrollerType.Leaderboard)
                            && point.x < view.scroller.x + view.scroller.width) {
                            selected = true;
                        }
                    }
                    break;
                case 1:
                    item.hover = false;
                    if (canSelect && namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y - offset, item.x + item.width, item.y + item.height - offset)) {
                        item.hover = true;

                        if (view.scroller.type === namespace.Pepper.ScrollerType.AddAsset) {
                            if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 1.7, item.y + view.unit * 0.25 - offset, item.x + view.unit * 1.7 + view.unit * 2.4, item.y + view.unit * 0.25 - offset + view.unit * 0.7)) {
                                item.overAddBtn = false;
                            }
                        }
                    }
                    else if (item.selected) {
                        item.selected = false;
                    }
                    break;
                case 2:
                    if (item.selected) {
                        item.selected = false;
                        item.hover = false;
                        callback(item, i);
                    }
                    break;
            }
        }
        return selected;
    }

    function testList(testType, point, list, isDown, callback) {
        for (let i = 0; i < list.items.length; i += 1) {
            const item = list.items[i];
            switch (testType) {
                case 0:
                    item.selected = false;
                    item.hover = false;
                    item.hasClick = false;
                    item.overAddBtn = false;
                    item.overCopyBtn = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y - view.list.offset, item.x + item.width, item.y + item.height - view.list.offset)) {
                        item.selected = true;
                        item.hasClick = true;

                        if (item.data.memo) {
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 7.5, item.y - view.list.offset, item.x + view.unit * 7.5 + view.unit * 0.7, item.y + item.height - view.list.offset)) {
                                item.overMemoBtn = true;
                            }
                        }

                        if (item.data.type !== "asset") {
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - view.unit * 0.97, item.y - view.list.offset, item.x + item.width, item.y + item.height - view.list.offset)) {
                                item.overLaunchBtn = true;
                            }
                        }

                        switch (item.data.type) {
                            case "asset":
                                if (!namespace.Pepper.queryAsset && namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 1.7, item.y + view.unit * 0.25 - view.list.offset, item.x + view.unit * 1.7 + view.unit * 2.4, item.y + view.unit * 0.25 - view.list.offset + view.unit * 0.7)) {
                                    item.overAddBtn = true;
                                }
                                break;
                            case "payment":
                            case "change_trust":
                            case "create_account":
                            case "allow_trust":
                                if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 6.5, item.y - view.list.offset, item.x + view.unit * 6.5 + view.unit * 0.7, item.y + item.height - view.list.offset)) {
                                    item.overCopyBtn = true;
                                }
                                break;
                        }
                    }
                    break;
                case 1:
                    item.hover = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y - view.list.offset, item.x + item.width, item.y + item.height - view.list.offset)) {
                        if (isDown) {
                            if (item.hasClick) {
                                item.selected = true;
                                item.hover = true;

                                if (item.data.memo) {
                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 7.5, item.y - view.list.offset, item.x + view.unit * 7.5 + view.unit * 0.7, item.y + item.height - view.list.offset)) {
                                        item.overMemoBtn = false;
                                    }
                                }

                                if (item.data.type !== "asset") {
                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - view.unit * 0.97, item.y - view.list.offset, item.x + item.width, item.y + item.height - view.list.offset)) {
                                        item.overLaunchBtn = false;
                                    }
                                }

                                switch (item.data.type) {
                                    case "asset":
                                        if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 1.7, item.y + view.unit * 0.25 - view.list.offset, item.x + view.unit * 1.7 + view.unit * 2.4, item.y + view.unit * 0.25 - view.list.offset + view.unit * 0.7)) {
                                            item.overAddBtn = false;
                                        }
                                        break;
                                    case "payment":
                                    case "change_trust":
                                    case "create_account":
                                    case "allow_trust":
                                        if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 6.5, item.y - view.list.offset, item.x + view.unit * 6.5 + view.unit * 0.7, item.y + item.height - view.list.offset)) {
                                            item.overCopyBtn = false;
                                        }
                                        break;
                                }
                            }
                        }
                        else {
                            item.hover = true;
                        }
                    }
                    else if (item.selected) {
                        item.hasClick = false;
                        item.selected = false;
                    }
                    break;
                case 2:
                    if (item.selected) {
                        item.selected = false;
                        item.hover = false;

                        if (item.hasClick) {
                            callback(item, i);
                        }
                    }
                    break;
            }
        }
    }

    function testBook(testType, point, list, isDown, callback) {
        for (let i = 0; i < list.items.length; i += 1) {
            const item = list.items[i];

            let y = item.data.spot ? item.y - view.book.offset + view.unit * 0.2 < view.book.y ? view.book.y + view.book.offset - view.unit * 0.2 : item.y : item.y;
            y = item.data.spot ? item.y + item.height - view.book.offset + view.unit * 0.2 > view.book.y + view.book.height ? view.book.y + view.book.height + view.book.offset - item.height : y : y;

            switch (testType) {
                case 0:
                    item.selected = false;
                    item.hover = false;
                    item.hasClick = false;
                    item.overAddBtn = false;
                    item.overCopyBtn = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.book.offset, item.x + item.width, y + item.height - view.book.offset)) {
                        item.selected = true;
                        item.hasClick = true;

                        if (item.data.spot) {
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - view.unit * 3, y - view.book.offset, item.x + item.width, y + item.height - view.book.offset)) {
                                item.overHistBtn = true;
                            }
                        }
                    }
                    break;
                case 1:
                    item.hover = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.book.offset, item.x + item.width, y + item.height - view.book.offset)) {
                        if (isDown) {
                            if (item.hasClick) {
                                item.selected = true;
                                item.hover = true;

                                if (item.data.spot) {
                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - view.unit * 3, y - view.book.offset, item.x + item.width, y + item.height - view.book.offset)) {
                                        item.overHistBtn = false;
                                    }
                                }
                            }
                        }
                        else {
                            item.hover = true;
                        }
                    }
                    else if (item.selected) {
                        item.hasClick = false;
                        item.selected = false;
                    }
                    break;
                case 2:
                    if (item.selected) {
                        item.selected = false;
                        item.hover = false;

                        if (item.hasClick) {
                            callback(item, i);
                        }
                    }
                    break;
            }
        }
    }

    function testStore(testType, point, list, isDown, callback) {
        for (let i = 0; i < list.items.length; i += 1) {
            const item = list.items[i];
            let height = view.store.rowHeight * 0.8 + item.height * 0.2;
            let y = item.spot ? item.y - view.store.offset + view.unit * 0.2 < view.store.y ? view.store.y + view.store.offset - view.unit * 0.2 : item.y : item.y;
            y = item.spot ? item.y + item.height - view.store.offset + view.unit * 0.2 > view.store.y + view.store.height ? view.store.y + view.store.height + view.store.offset - item.height : y : y;

            switch (testType) {
                case 0:
                    item.selected = false;
                    item.hover = false;
                    item.hasClick = false;
                    item.overPlayBtn = false;
                    item.overScoreBtn = false;
                    item.overShopBtn = false;
                    
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.store.offset, item.x + item.width, y + item.height - view.store.offset)) {
                        item.selected = true;                        
                        item.hasClick = true;
                        if (item.spot) {
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.store.offset, item.x + item.width * 0.3, y + item.height - view.store.offset)) {
                                item.overGamesBtn = true;
                            }

                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width * 0.3, y - view.store.offset, item.x + item.width * 0.6, y + item.height - view.store.offset)) {
                                item.overAppsBtn = true;
                            }
                        }
                        else {
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 1.2, y - view.store.offset, item.x + item.width, y + height - view.store.offset)) {
                                item.overPlayBtn = true;
                            }
    
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 1.9, y - view.store.offset, item.x + item.width - height * 1.2, y + height - view.store.offset)
                                && item.data && item.data.data && item.data.data.leaderboard) {
                                item.overScoreBtn = true;
                            }
    
                            if (item.data.data.type === "app") {
                                if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 1.9, y - view.store.offset, item.x + item.width - height * 1.2, y + height - view.store.offset)
                                    && item.data && item.data.data && item.data.data.shop) {
                                    item.overShopBtn = true;
                                }
                            }
                            else {
                                if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 2.7, y - view.store.offset, item.x + item.width - height * 1.9, y + height - view.store.offset)
                                    && item.data && item.data.data && item.data.data.shop) {
                                    item.overShopBtn = true;
                                }
                            }
                        }
                    }
                    break;
                case 1:
                    item.hover = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.store.offset, item.x + item.width, y + item.height - view.store.offset)) {
                        if (isDown) {
                            if (item.hasClick) {
                                item.selected = true;
                                item.hover = true;
                                if (item.spot) {
                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.store.offset, item.x + item.width * 0.3, y + item.height - view.store.offset)) {
                                        item.overGamesBtn = false;
                                    }
        
                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width * 0.3, y - view.store.offset, item.x + item.width * 0.6, y + item.height - view.store.offset)) {
                                        item.overAppsBtn = false;
                                    }
                                }
                                else {
                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 1.2, y - view.store.offset, item.x + item.width, y + height - view.store.offset)) {
                                        item.overPlayBtn = false;
                                    }

                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 1.9, y - view.store.offset, item.x + item.width - height * 1.2, y + height - view.store.offset)) {
                                        item.overScoreBtn = false;
                                    }

                                    if (item.data.data.type === "app") {
                                        if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 1.9, y - view.store.offset, item.x + item.width - height * 1.2, y + height - view.store.offset)) {
                                            item.overShopBtn = false;
                                        }  
                                    }
                                    else  {
                                        if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - height * 2.7, y - view.store.offset, item.x + item.width - height * 1.9, y + height - view.store.offset)) {
                                            item.overShopBtn = false;
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            item.hover = true;
                        }
                    }
                    else if (item.selected) {
                        item.hasClick = false;
                        item.selected = false;
                    }
                    break;
                case 2:
                    if (item.selected) {
                        item.selected = false;
                        item.hover = false;

                        if (item.hasClick) {
                            callback(item, i);
                        }
                    }
                    break;
            }
        }
    }

    function testShop(testType, point, list, isDown, callback) {
        for (let i = 0; i < list.items.length; i += 1) {
            const item = list.items[i];

            let y = item.y;

            switch (testType) {
                case 0:
                    item.selected = false;
                    item.hover = false;
                    item.hasClick = false;
                    item.overBuyBtn = false;
                    item.overMoreBtn = false;
                    // item.x + item.width - this.unit * 2.2, item.y + item.height - this.unit, this.unit * 2, this.unit * 0.8
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.shop.offset, item.x + item.width, y + item.height - view.shop.offset)) {
                        item.selected = true;
                        item.hasClick = true;

                        if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - view.unit * 2.2, y - view.shop.offset + item.height - view.unit, item.x + item.width - view.unit * 0.2, y - view.shop.offset + item.height - view.unit + view.unit * 0.8)) {
                            item.overBuyBtn = true;
                        }

                        if (item.data.moreLink || item.data.code) {
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 0.2, y - view.shop.offset + item.height - view.unit, item.x + view.unit * 2.2, y - view.shop.offset + item.height - view.unit + view.unit * 0.8)) {
                                item.overMoreBtn = true;
                            }
                        }
                    }
                    break;
                case 1:
                    item.hover = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, y - view.shop.offset, item.x + item.width, y + item.height - view.shop.offset)) {
                        if (isDown) {
                            if (item.hasClick) {
                                item.selected = true;
                                item.hover = true;

                                if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + item.width - view.unit * 2.2, y - view.shop.offset + item.height - view.unit, item.x + item.width - view.unit * 0.2, y - view.shop.offset + item.height - view.unit + view.unit * 0.8)) {
                                    item.overBuyBtn = false;
                                }

                                if (item.data.moreLink || item.data.code) {
                                    if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 0.2, y - view.shop.offset + item.height - view.unit, item.x + view.unit * 2.2, y - view.shop.offset + item.height - view.unit + view.unit * 0.8)) {
                                        item.overMoreBtn = false;
                                    }
                                }
                            }
                        }
                        else {
                            item.hover = true;
                        }
                    }
                    else if (item.selected) {
                        item.hasClick = false;
                        item.selected = false;
                    }
                    break;
                case 2:
                    if (item.selected) {
                        item.selected = false;
                        item.hover = false;

                        if (item.hasClick) {
                            callback(item, i);
                        }
                    }
                    break;
            }
        }
    }

    function testCarousel(testType, point, carousel, isDown, callback) {
        let clicked = false;
        for (let i = 0; i < carousel.items.length; i += 1) {
            const item = carousel.items[i];
            switch (testType) {
                case 0:
                    item.selected = false;
                    item.hover = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x - view.carousel.offset, item.y, item.x + item.width - view.carousel.offset, item.y + item.height)) {
                        item.selected = true;
                        clicked = true;
                    }
                    break;
                case 1:
                    item.hover = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x - view.carousel.offset, item.y, item.x + item.width - view.carousel.offset, item.y + item.height)) {
                        if (isDown) {
                            item.selected = true;
                        }
                        item.hover = true;
                    }
                    else if (item.selected) {
                        item.selected = false;
                    }
                    break;
                case 2:
                    if (item.selected) {
                        item.selected = false;
                        item.hover = false;
                        callback(item, i);
                    }
                    break;
            }
        }

        return clicked;
    }

    function testElement(testType, point, item, isDown, callback) {
        let clicked = false;
        switch (testType) {
            case 0:
                item.selected = false;
                item.hover = false;
                item.hasClick = false;
                if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y, item.x + item.width, item.y + item.height)) {
                    item.selected = true;
                    item.hasClick = true;
                    clicked = true;
                }
                break;
            case 1:
                item.hover = false;
                if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y, item.x + item.width, item.y + item.height)) {
                    if (isDown) {
                        if (item.hasClick) {
                            item.selected = true;
                            item.hover = true;
                        }
                    }
                    else {
                        item.hover = true;
                    }
                }
                else if (item.selected) {
                    item.hasClick = false;
                    item.selected = false;
                    item.selectTime = 0.5;
                }
                break;
            case 2:
                if (item.selected) {
                    item.selected = false;
                    item.hover = false;
                    item.selectTime = 0.5;

                    if (item.hasClick) {
                        callback();
                    }
                }
                break;
        }

        return clicked;
    }

    function setCapture(element, event) {
        if (element.setPointerCapture) {
            const id = typeof event.originalEvent.pointerId === "undefined" || typeof event.originalEvent.pointerId === undefined ? 1 : event.originalEvent.pointerId;
            try {
                element.setPointerCapture(id);
            }
            catch (err) {
                if (event.originalEvent.pointerId) {
                    console.log(err);
                }
            }
        }
    }

    function loadStore (swap) {
        if (view) {
            
            // Copy the cached store data.
            if (namespace.Pepper.storeDataCache.length) {
                namespace.Pepper.storeData = namespace.Pepper.storeDataCache.slice();
            }
            
            view.resetStore();
            view.store.items = [];
            let selectIt = true;
            for (let i = 0; i < namespace.Pepper.storeData.length; i += 1) {
                if (i === 0) { // Featured item takes 2 rows.
                    view.store.items.push({ "spot": false, "data": namespace.Pepper.storeData[i] });
                }
                else {
                    if (i == 1) {
                        view.store.items.push({ "spot": true, "data": namespace.Pepper.storeData[i] });
                    }
                    else {
                        if((!namespace.Pepper.storeData[i].data.type && view.exploreType === namespace.Pepper.ExploreType.Game)
                            || namespace.Pepper.storeData[i].data.type === view.exploreType) {
                            view.store.items.push({ "spot": false, "data": namespace.Pepper.storeData[i] });
                            if (selectIt) {
                                selectIt = false;
                                view.store.items[view.store.items.length - 1].lastSelected = true;
                                view.store.items[view.store.items.length - 1].lastSelectedTime = 0;
                            }
                        }
                    }
                }     
            }
            view.shopTabTime = swap ? 0.5 : 0;
        }
    }

    function loadShop () {
        if (view) {        
            view.resetShop();  
            
            for (let i = 0; i < view.carousel.items.length; i += 1) {
                delete view.carousel.items[i].shopPriceRate;
                delete view.carousel.items[i].collectiblePrices;
            }

            const stellarNet = new namespace.Core.StellarNetwork();
            if (view.selectedGameShop && view.selectedGameShop.data && view.selectedGameShop.data.shop) { 
                view.shop.data = view.selectedGameShop;
                let amount;
                if (view.selectedGameShop.data.shop.items) {
                    for (let i = 0; i < view.selectedGameShop.data.shop.items.length; i += 1) {
                        view.shop.items.push({ "data": view.selectedGameShop.data.shop.items[i] });

                        // NOTE: To limit the number of queries for now on endpoints,
                        // path resolution will be executed on min amount needed to buy at least 1 item.
                        // Two side effects:
                        //      1 - Actual price recalculation may likely result in either 
                        //          equal or worse price for buyer (stack depth).
                        //      2 - Inability to display price approx. if user balance is below
                        //          the lowest price.
                        if (view.selectedGameShop.data.shop.items[i].price) {
                            amount = amount ? Math.min(amount, Number(view.selectedGameShop.data.shop.items[i].price)) 
                                        : Number(view.selectedGameShop.data.shop.items[i].price);
                        }
                        else if(view.selectedGameShop.data.shop.items[i].collectible) {
                            stellarNet.findPaymentPaths(
                                view.selectedGameShop.data.shop.account,
                                view.selectedGameShop.data.shop.items[i].code,
                                view.selectedGameShop.data.shop.items[i].issuer,
                                namespace.Pepper.Tools.formatPrice(view.selectedGameShop.data.shop.items[i].priceScale || 1),
                                view.selectedGameShop.data.shop.items[i].id,
                                (success, result, code, issuer, id) => {
                                    for (let i = 0; i < view.carousel.items.length; i += 1) {
                                        let item = view.carousel.items[i];
        
                                        if (success) {
                                            // Extract the best price from results.
                                            let sourceAmount;
                                            for (let v = 0; v < result.length; v += 1) {
                                                if (result[v].source_asset_type === "native" && i === 0 || 
                                                    (item.asset.code === result[v].source_asset_code
                                                        && item.asset.issuer === result[v].source_asset_issuer)) {
                                                    if (!sourceAmount) {
                                                        sourceAmount = Number(result[v].source_amount);
                                                    }
                                                    else{
                                                        sourceAmount = Math.min(Number(result[v].source_amount), sourceAmount);
                                                    }
                                                }
                                            }
                                            if (!item.collectiblePrices) {
                                                item.collectiblePrices = {};
                                            }    
                                            item.collectiblePrices[code + issuer + id] = namespace.Pepper.Tools.formatPrice(sourceAmount);
                                        }
                                    }
                                });
                        }
                    }
                }
                
                if (amount && namespace.Core.currentAccount.data) {                   
                    stellarNet.findPaymentPaths(
                        view.selectedGameShop.data.shop.account,
                        view.selectedGameShop.data.shop.code,
                        view.selectedGameShop.data.shop.issuer,
                        namespace.Pepper.Tools.formatPrice(amount),
                        null,
                        (success, result) => {                      
                            for (let i = 0; i < view.carousel.items.length; i += 1) {
                                let item = view.carousel.items[i];
                                item.shopPriceRate = {
                                    "amount": namespace.Pepper.Tools.formatPrice(amount),
                                };

                                if (success) {
                                    // Extract the best price from results.
                                    let sourceAmount;
                                    for (let v = 0; v < result.length; v += 1) {
                                        if (result[v].source_asset_type === "native" && i === 0 || 
                                            (item.asset.code === result[v].source_asset_code
                                                && item.asset.issuer === result[v].source_asset_issuer)) {
                                            if (!sourceAmount) {
                                                sourceAmount = Number(result[v].source_amount);
                                            }
                                            else{
                                                sourceAmount = Math.min(Number(result[v].source_amount), sourceAmount);
                                            }
                                        }
                                    }
                                    item.shopPriceRate.sourceAmount = namespace.Pepper.Tools.formatPrice(sourceAmount);
                                }
                                else {
                                    item.shopPriceRate.sourceAmount = namespace.Pepper.Tools.formatPrice(0);
                                    console.log(result);
                                }                                
                            }
                        });
                }
            }
        }
    }

    function loadOrderBook(reset) {
        if (view && view.activityType === namespace.Pepper.ActivityType.Trade && view.isActivityMode && view.book) {
            const base = view.getActiveCarouselItem().asset;
            if (base) {
                const quote = view.quoteAssets[base.code + base.issuer];
                if (quote) {
                    if (reset) {
                        view.resetBook();
                        $(".trade-input").val("");
                        updateTradeInputs();
                    }
                    view.book.items = [];
                    view.book.id = base.code + base.issuer + quote.code + quote.issuer;
                    let book = namespace.Pepper.orderBooks[view.book.id];
                    if (book) {

                        for (let i = book.asks.length - 1; i >= 0; i -= 1) {
                            view.book.items.push({ "data": book.asks[i] });
                        }

                        let total = 0;
                        for (let i = view.book.items.length - 1; i >= 0; i -= 1) {
                            total += Number(view.book.items[i].data.baseAmount);
                            view.book.items[i].baseTotal = total.toFixed(7);
                        }

                        if (book.asks.length || book.bids.length) {
                            view.book.items.push({ "data": { "spot": true } });
                        }

                        total = 0;
                        for (let i = 0; i < book.bids.length; i += 1) {
                            total += Number(book.bids[i].baseAmount);
                            view.book.items.push({ "data": book.bids[i], "baseTotal": total.toFixed(7) });
                        }

                        view.needRedraw = true;
                    }
                }
            }
        }
    }

    function loadChart() {
        const item = view.getActiveCarouselItem();
        if (!item.chartMode) {
            item.chartMode = true;
            item.transitionTime = 0.5;

            if (!item.canvas) {
                item.canvas = document.createElement("canvas");
                document.getElementById("chart-container").appendChild(item.canvas);
                item.canvas.width = item.width;
                item.canvas.height = item.height * 0.8;
                item.canvas.style.width = item.width + "px";
                item.canvas.style.height = item.height * 0.8 + "px";
            }

            const createChart = function (priceArray, volumeArray, startTime) {
                const date = new Date(startTime * 1000);
                let hours = date.getHours();
                let labels = [];
                for (let i = 0; i < 13; i += 1) {
                    if (i === 0 || i === 6 || i === 12) {
                        labels.push(hours + ":00");
                    }
                    else {
                        labels.push("");
                    }
                    hours += 2;
                    hours %= 24;
                }

                const config = {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: "Price",
                            xAxisID: 'x-axis-1',
                            yAxisID: 'y-axis-1',
                            backgroundColor: "rgba(255, 99, 132, 1)",
                            borderColor: "rgba(255, 99, 132, 1)",
                            data: priceArray,
                            fill: false,
                            type: "line"
                        }, {
                            label: "Volume",
                            xAxisID: 'x-axis-1',
                            yAxisID: 'y-axis-2',
                            fill: false,
                            backgroundColor: "rgba(61, 82, 111, 1)",
                            borderColor: "rgba(61, 82, 111, 1)",
                            data: volumeArray
                        }]
                    },
                    options: {
                        responsive: true,
                        hoverMode: 'nearest',
                        intersect: true,
                        title: {
                            display: false
                        },
                        legend: {
                            labels: {
                                fontSize: view.baseFontSize * 0.85 / pixelRatio
                            }
                        },
                        scales: {
                            xAxes: [{
                                id: 'x-axis-1',
                                position: 'bottom',
                                ticks: {
                                    fontSize: view.baseFontSize * 0.7 / pixelRatio
                                }
                            }],
                            yAxes: [{
                                type: 'linear',
                                display: true,
                                position: 'left',
                                id: 'y-axis-1'
                            }, {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                id: 'y-axis-2',
                                gridLines: {
                                    drawOnChartArea: false
                                },
                                ticks: {
                                    callback: function (value, index, values) {
                                        function abbrNum(number, decPlaces) {
                                            decPlaces = Math.pow(10, decPlaces);
                                            var abbrev = ["k", "m", "b", "t"];
                                            for (let i = abbrev.length - 1; i >= 0; i--) {
                                                var size = Math.pow(10, (i + 1) * 3);
                                                if (size <= number) {
                                                    number = Math.round(number * decPlaces / size) / decPlaces;
                                                    if (number === 1000 && i < abbrev.length - 1) {
                                                        number = 1;
                                                        i++;
                                                    }
                                                    number += abbrev[i];
                                                    break;
                                                }
                                            }
                                            return number;
                                        }
                                        return abbrNum(value, 1);
                                    }
                                }
                            }]
                        }
                    }
                };
                const chart = new Chart(item.canvas, config);
                $(item.canvas).hide(); // Hide chart after instantiation.
            };

            if (namespace.Pepper.cachedMarketData
                && namespace.Pepper.cachedMarketData[view.getActiveCarouselItem().asset.code]
                && namespace.Pepper.cachedMarketData[view.getActiveCarouselItem().asset.code].time > namespace.Core.Utils.getTime()) {
                const cachedData = namespace.Pepper.cachedMarketData[view.getActiveCarouselItem().asset.code];
                if (cachedData.priceArray && cachedData.priceArray.length === 13) {
                    createChart(
                        cachedData.priceArray,
                        cachedData.volumeArray,
                        cachedData.time);
                    view.getActiveCarouselItem().hasChart = true;
                    view.chartBtn.selectTime = 1;
                }
                else {
                    view.getActiveCarouselItem().hasChart = false;
                }
            }
            else {
                view.getActiveCarouselItem().loadingChart = true;
                $.post(namespace.config.apiUrl + "/.market/gethistory", { "currency": view.getActiveCarouselItem().asset.code }, function (response) {
                    view.getActiveCarouselItem().loadingChart = false;
                    if (response) {
                        if (response.length) {
                            var priceArray = [];
                            var volumeArray = [];
                            for (let i = 0; i < Math.min(response.length, 13); i += 1) {
                                priceArray.push(response[i].price);
                                volumeArray.push(response[i].volume);
                            }

                            if (!namespace.Pepper.cachedMarketData) {
                                namespace.Pepper.cachedMarketData = {};
                            }

                            if (priceArray.length === 13) {
                                // Cache the data for 5 minutes.
                                const newCacheData = {};
                                newCacheData.time = namespace.Core.Utils.getTime() + 5 * 60;
                                newCacheData.priceArray = priceArray.slice();
                                newCacheData.volumeArray = volumeArray.slice();
                                namespace.Pepper.cachedMarketData[view.getActiveCarouselItem().asset.code] = newCacheData;
                                createChart(priceArray, volumeArray, response[0].time);
                                view.getActiveCarouselItem().hasChart = true;
                                view.chartBtn.selectTime = 1;
                            }
                            else {
                                const newCacheData = {};
                                newCacheData.time = namespace.Core.Utils.getTime() + 10;
                                namespace.Pepper.cachedMarketData[view.getActiveCarouselItem().asset.code] = newCacheData;
                                view.getActiveCarouselItem().hasChart = false;
                            }
                        }
                        else {
                            const newCacheData = {};
                            newCacheData.time = namespace.Core.Utils.getTime() + 10;
                            namespace.Pepper.cachedMarketData[view.getActiveCarouselItem().asset.code] = newCacheData;
                            view.getActiveCarouselItem().hasChart = false;
                        }
                    }
                });
            }
        }
    }

    function pointerDown(event) {
        const point = { "x": event.pageX * pixelRatio, "y": event.pageY * pixelRatio };

        setCapture($("#mainview")[0], event);

        if (namespace.Pepper.isDesktop) {
            $("#activity-view iframe").css("pointer-events", "none");
        }

        if (rotateScreen || !view || showLoader ||
            view.scrollerTime || view.scrollerEndTime || view.showPinLoader
            || view.modalPageEndTime) {
            return;
        }

        view.needRedraw = true;

        if (view.showAbout) {
            domShowAboutPage(false);
            return;
        }

        isPointerDown = true;
        if (view.showModalPage) {
            testElement(0, point, view.modalPageBtn, false);
            if (view.modalStep === namespace.Pepper.WizardType.ViewAsset) {
                testElement(0, point, view.modalAddAssetBtn, false);
            }

            if (view.modalStep === namespace.Pepper.WizardType.ImportAccount) {
                testElement(0, point, view.closeModalBtn, false);
                testElement(0, point, view.modalQrBtn, false);
                testElement(0, point, view.modalPasswordBtn, false);
            }
        }
        else if (view.showScroller) {
            if (namespace.Pepper.Tools.pointInRect(point.x, point.y,
                view.scroller.x, view.scroller.y - view.scroller.headerHeight - namespace.Pepper.barHeight, view.scroller.x + view.scroller.width, view.scroller.y)) {
                
                let btnClicked;

                if (view.scroller.type === namespace.Pepper.ScrollerType.AccountSettings) {
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y,
                        view.scroller.x, view.scroller.y - view.unit * 1.4, view.scroller.x + view.scroller.width, view.scroller.y)) {
                        domShowRenameForm(true);
                    }
                    else {
                        domShowRenameForm(false);
                        view.scrollerEndTime = 0.3;
                        view.discardedPanel = true;
                    }
                }
                else if (view.scroller.type !== namespace.Pepper.ScrollerType.AddAsset) {
                    if (!btnClicked) {
                        domShowRenameForm(false);
                        view.scrollerEndTime = 0.3;
                        view.discardedPanel = true;

                        if (view.isActivityMode) {
                            if (view.activityType === namespace.Pepper.ActivityType.Trade) {
                                domShowTradeForm(true);
                            }
                        }
                    }
                }
                else {
                    let clicked = testElement(0, point, view.closeScrollerBtn, false);
                    if (!clicked) {
                        $("#domain").focus();
                    }
                }
            }
            else {
                view.scroller.downDistance = 0;
                view.scroller.isDown = true;
                view.scroller.canClick = true;
                view.scroller.downTime = 0;
                view.scroller.point = { "x": point.x, "y": point.y };
                view.scroller.scrollTime = 1.5;

                const selected = testScroller(0, point, view.scroller, false);
                if (!selected
                    && (view.scroller.type === namespace.Pepper.ScrollerType.AssetsMenu
                        || view.scroller.type === namespace.Pepper.ScrollerType.ShopMenu
                        || view.scroller.type === namespace.Pepper.ScrollerType.FilterMenu
                        || view.scroller.type === namespace.Pepper.ScrollerType.QuotesMenu
                        || view.scroller.type === namespace.Pepper.ScrollerType.LastTrades
                        || view.scroller.type === namespace.Pepper.ScrollerType.LiveOrders
                        || view.scroller.type === namespace.Pepper.ScrollerType.CoinSwap
                        || view.scroller.type === namespace.Pepper.ScrollerType.Leaderboard
                        || view.scroller.type === namespace.Pepper.ScrollerType.AccountSettings)) {
                    if (view.scroller.type !== namespace.Pepper.ScrollerType.AccountSettings) {
                        view.scrollerEndTime = 0.3;
                        view.discardedPanel = true;

                        if (view.isActivityMode) {
                            if (view.activityType === namespace.Pepper.ActivityType.Trade) {
                                domShowTradeForm(true);
                            }
                        }
                    }
                    else {
                        domShowRenameForm(false);
                        view.deleteStep = 0;
                        view.scroller.items[view.scroller.items.length - 1].label = namespace.Pepper.Resources.localeText[141];
                    }
                }
            }
        }
        else {
            if (view.page === namespace.Pepper.PageType.SignUp || view.page === namespace.Pepper.PageType.SignIn) {
                if (!view.isPinMenu) {
                    for (let i = 0; i < view.numPad.length; i += 1) {
                        testElement(0, point, view.numPad[i], false);
                    }
                    testElement(0, point, view.pinBtn, false);
                    testElement(0, point, view.pinMenuBtn, false);
                    testElement(0, point, view.pinSwitchBtn, false);
                }
                else {
                    let down = false;
                    for (let i = 0; i < view.pinMenu.length; i += 1) {
                        testElement(0, point, view.pinMenu[i], false);
                        if (view.pinMenu[i].selected) {
                            down = true;
                        }
                    }

                    if (!down) {
                        view.isPinMenu = false;
                        view.discardedPanel = true;
                    }
                }
            }
            else if (view.page === namespace.Pepper.PageType.Dashboard) {
                if (view.isDashboardMenu) {
                    let down = false;
                    for (let i = 0; i < view.dashboardMenu.length; i += 1) {
                        testElement(0, point, view.dashboardMenu[i], false);
                        if (view.dashboardMenu[i].selected) {
                            down = true;
                        }
                    }

                    if (!down) {
                        view.isDashboardMenu = false;
                        view.discardedPanel = true;
                    }
                }
                else {
                    let clicked;
                    if (!clicked && !view.isActivityMode && !namespace.Core.currentAccount.watchOnly) {
                        clicked = testElement(0, point, view.sendBtn, false);
                    }
                    if (!clicked && !view.isActivityMode) {
                        clicked = testElement(0, point, view.receiveBtn, false);
                    }
                    if (!clicked && !view.isActivityMode && !namespace.Core.currentAccount.watchOnly) {
                        clicked = testElement(0, point, view.tradeBtn, false);
                    }
                    if (!clicked && !(view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Exchange && !view.selectedGameShop)) {
                        clicked = testElement(0, point, view.assetPicker, false);
                    }
                    if (!clicked && !view.isActivityMode) {
                        clicked = testElement(0, point, view.transactionsBtn, false);
                    }
                    if (!clicked && !view.isActivityMode) {
                        clicked = testElement(0, point, view.assetsBtn, false);
                    }
                    if (!clicked && !view.isActivityMode) {
                        clicked = testElement(0, point, view.moreBtn, false);
                    }
                    if (!clicked && !view.isActivityMode) {
                        clicked = testElement(0, point, view.chartBtn, false);
                    }
                    if (!clicked && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Trade && view.getActiveCarouselItem() !== view.placeHolderAsset) {
                        clicked = testElement(0, point, view.quoteBtn, false);
                    }
                    if (!clicked && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Trade) {
                        clicked = testElement(0, point, view.buyBtn, false);
                    }
                    if (!clicked && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Trade) {
                        clicked = testElement(0, point, view.cancelOrderBtn, false);
                        clicked = testElement(0, point, view.confirmOrderBtn, false);
                    }
                    if (!clicked && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Trade) {
                        clicked = testElement(0, point, view.sellBtn, false);
                    }
                    if (!clicked && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Trade && namespace.Core.currentAccount.offers.length) {
                        clicked = testElement(0, point, view.ordersBtn, false);
                    }
                    if (!clicked && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Exchange && !view.selectedGameShop) {
                        clicked = testElement(0, point, view.gamerIdBtn, false);
                    }
                    if (!clicked && !view.isActivityMode) {
                        clicked = testElement(0, point, view.filterBtn, false);
                    }
                    if (!clicked && !view.isActivityMode && !namespace.Core.currentAccount.watchOnly) {
                        clicked = testElement(0, point, view.addAssetBtn, false);
                    }
                    if (!clicked) {
                        clicked = testElement(0, point, view.menuBtn, false);
                    }
                    if (!clicked) {
                        clicked = testElement(0, point, view.accountBtn, false);
                    }
                    if (!clicked) {
                        clicked = testElement(0, point, view.marketBtn, false);
                    }
                    if (!clicked && view.carousel.offset === view.carousel.anchor) {
                        if (!view.isActivityMode
                            || view.activityType === namespace.Pepper.ActivityType.SelectSendAmount
                            || view.activityType === namespace.Pepper.ActivityType.Receive
                            || view.activityType === namespace.Pepper.ActivityType.Trade
                            || (view.activityType === namespace.Pepper.ActivityType.Exchange && view.selectedGameShop)) {
                            view.carousel.downDistance = 0;
                            view.carousel.isDown = true;
                            view.carousel.canClick = true;
                            view.carousel.downTime = 0;
                            view.carousel.point = { "x": point.x, "y": point.y };
                            view.carousel.scrollTime = 1.5;
                            view.carousel.velocity = 0;
                            view.carousel.anchored = false;
                        }
                        view.carousel.clicked = testCarousel(0, point, view.carousel, false);
                    }

                    if (!clicked) {
                        if (view.isActivityMode) {
                            testElement(0, point, view.numPadSendBtn, false);
                            testElement(0, point, view.numPadCloseBtn, false);

                            if (view.activityType === namespace.Pepper.ActivityType.SelectSendAmount) {
                                for (let i = 0; i < view.numPad.length; i += 1) {
                                    testElement(0, point, view.numPad[i], false);
                                }
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.SelectSendRecipient) {
                                testElement(0, point, view.bookBtn, false);
                                testElement(0, point, view.pasteBtn, false);
                                testElement(0, point, view.qrBtn, false);
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.Receive) {
                                testElement(0, point, view.depositBtn, false);
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.Trade) {
                                if (!namespace.Core.currentAccount.queuedOrder) {
                                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y,
                                        view.book.x, view.book.y, view.book.x + view.book.width, view.book.y + view.book.height)) {
                                        view.book.downDistance = 0;
                                        view.book.isDown = true;
                                        view.book.canClick = true;
                                        view.book.downTime = 0;
                                        view.book.point = { "x": point.x, "y": point.y };
                                        view.book.scrollTime = 1.5;
                                        testBook(0, point, view.book, false);
                                    }
                                }
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.Exchange) {
                                if (view.selectedGameShop) {
                                    testElement(0, point, view.shopMenuBtn, false);
                                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y,
                                        view.shop.x, view.shop.y, view.shop.x + view.shop.width, view.shop.y + view.shop.height)) {
                                        view.shop.downDistance = 0;
                                        view.shop.isDown = true;
                                        view.shop.canClick = true;
                                        view.shop.downTime = 0;
                                        view.shop.point = { "x": point.x, "y": point.y };
                                        view.shop.scrollTime = 1.5;
                                        testShop(0, point, view.shop, false);
                                    }
                                }
                                else {
                                    testElement(0, point, view.promoBtn, false);
                                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y,
                                        view.store.x, view.store.y, view.store.x + view.store.width, view.store.y + view.store.height)) {
                                        view.store.downDistance = 0;
                                        view.store.isDown = true;
                                        view.store.canClick = true;
                                        view.store.downTime = 0;
                                        view.store.point = { "x": point.x, "y": point.y };
                                        view.store.scrollTime = 1.5;
                                        testStore(0, point, view.store, false);
                                    }
                                }
                            }
                        }
                        else if (namespace.Pepper.Tools.pointInRect(point.x, point.y,
                            view.list.x, view.list.y, view.list.x + view.list.width, view.list.y + view.list.height)) {
                            view.list.downDistance = 0;
                            view.list.isDown = true;
                            view.list.canClick = true;
                            view.list.downTime = 0;
                            view.list.point = { "x": point.x, "y": point.y };
                            view.list.scrollTime = 1.5;
                            testList(0, point, view.list, false);
                        }
                    }
                }
            }
        }
    }

    function pointerMove(event) {
        const point = { "x": event.pageX * pixelRatio, "y": event.pageY * pixelRatio };

        if (rotateScreen || !view || showLoader || view.scrollerTime || view.showPinLoader) {
            return;
        }

        view.needRedraw = true;

        if (view.showModalPage) {
            testElement(1, point, view.modalPageBtn, isPointerDown);
            if (view.modalStep === namespace.Pepper.WizardType.ViewAsset) {
                testElement(1, point, view.modalAddAssetBtn, isPointerDown);
            }

            if (view.modalStep === namespace.Pepper.WizardType.ImportAccount) {
                testElement(1, point, view.closeModalBtn, isPointerDown);
                testElement(1, point, view.modalQrBtn, isPointerDown);
                testElement(1, point, view.modalPasswordBtn, isPointerDown);
            }
        }
        else if (view.showScroller && !view.discardedPanel) {

            testElement(1, point, view.closeScrollerBtn, isPointerDown);
            testScroller(1, point, view.scroller, isPointerDown);

            if (view.scroller.maxOffset > 0) {
                if (view.scroller.isDown && view.scroller.hasBar) {
                    let multiplier = 1;
                    if (view.scroller.offset < view.scroller.minOffset) {
                        multiplier = 0.35;
                    }
                    else if (view.scroller.offset > view.scroller.maxOffset) {
                        multiplier = 0.35;
                    }

                    if (Math.abs(view.scroller.point.y - point.y) > view.scroller.rowHeight * 0.05) {
                        view.scroller.offset += (view.scroller.point.y - point.y) * multiplier;
                        view.scroller.downDistance += view.scroller.point.y - point.y;
                        view.scroller.point = { "x": point.x, "y": point.y };

                        view.scroller.canClick = false;
                    }
                }
            }
            view.scroller.scrollTime = 1.5;
        }
        else {
            if (view.page === namespace.Pepper.PageType.SignUp || view.page === namespace.Pepper.PageType.SignIn && !view.discardedPanel) {
                if (!view.isPinMenu) {
                    for (let i = 0; i < view.numPad.length; i += 1) {
                        testElement(1, point, view.numPad[i], isPointerDown);
                    }
                    testElement(1, point, view.pinBtn, isPointerDown);
                    testElement(1, point, view.pinMenuBtn, isPointerDown);
                    testElement(1, point, view.pinSwitchBtn, isPointerDown);
                }
                else {
                    for (let i = 0; i < view.pinMenu.length; i += 1) {
                        testElement(1, point, view.pinMenu[i], isPointerDown);
                    }
                }
            }
            else if (view.page === namespace.Pepper.PageType.Dashboard) {

                if (view.isDashboardMenu) {
                    for (let i = 0; i < view.dashboardMenu.length; i += 1) {
                        testElement(1, point, view.dashboardMenu[i], isPointerDown);
                    }
                }
                else {
                    if (view.carousel.clicked) {
                        testCarousel(1, point, view.carousel, isPointerDown);

                        if (view.carousel.maxOffset > 0) {
                            if (view.carousel.isDown && view.carousel.hasBar) {
                                let multiplier = 1;
                                if (view.carousel.offset < view.carousel.minOffset) {
                                    multiplier = 0.35;
                                }
                                else if (view.carousel.offset > view.carousel.maxOffset) {
                                    multiplier = 0.35;
                                }

                                if (Math.abs(view.carousel.point.x - point.x) > view.carousel.colWidth * 0.025) {
                                    view.carousel.offset += (view.carousel.point.x - point.x) * multiplier;
                                    view.carousel.downDistance += view.carousel.point.x - point.x;
                                    view.carousel.point = { "x": point.x, "y": point.y };
                                    view.carousel.canClick = false;
                                    view.carousel.direction = view.carousel.downDistance > 0 ? 1 : 0;
                                }
                            }
                        }
                        view.carousel.scrollTime = 1.5;
                    }
                    else {
                        testElement(1, point, view.menuBtn, isPointerDown);
                        testElement(1, point, view.accountBtn, isPointerDown);
                        testElement(1, point, view.marketBtn, isPointerDown);
                        testElement(1, point, view.assetPicker, isPointerDown);

                        if (view.isActivityMode) {
                            testElement(1, point, view.numPadSendBtn, isPointerDown);
                            testElement(1, point, view.numPadCloseBtn, isPointerDown);
                            testElement(1, point, view.quoteBtn, isPointerDown);

                            if (view.activityType === namespace.Pepper.ActivityType.SelectSendAmount) {
                                for (let i = 0; i < view.numPad.length; i += 1) {
                                    testElement(1, point, view.numPad[i], isPointerDown);
                                }
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.SelectSendRecipient) {
                                testElement(1, point, view.bookBtn, isPointerDown);
                                testElement(1, point, view.pasteBtn, isPointerDown);
                                testElement(1, point, view.qrBtn, isPointerDown);
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.Receive) {
                                testElement(1, point, view.depositBtn, isPointerDown);
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.Trade) {
                                
                                testElement(1, point, view.cancelOrderBtn, isPointerDown);
                                testElement(1, point, view.confirmOrderBtn, isPointerDown);

                                if (!namespace.Core.currentAccount.queuedOrder) {
                                    testElement(1, point, view.buyBtn, isPointerDown);
                                    testElement(1, point, view.sellBtn, isPointerDown);
                                    testElement(1, point, view.ordersBtn, isPointerDown);

                                    testBook(1, point, view.book, isPointerDown);
                                    if (view.book.maxOffset > 0) {
                                        if (view.book.isDown && view.book.hasBar) {
                                            let multiplier = 1;
                                            if (view.book.offset < view.book.minOffset) {
                                                multiplier = 0.35;
                                            }
                                            else if (view.book.offset > view.book.maxOffset) {
                                                multiplier = 0.35;
                                            }

                                            if (Math.abs(view.book.point.y - point.y) > view.book.rowHeight * 0.05) {
                                                view.book.offset += (view.book.point.y - point.y) * multiplier;
                                                view.book.downDistance += view.book.point.y - point.y;
                                                view.book.point = { "x": point.x, "y": point.y };
                                                view.book.canClick = false;
                                            }
                                        }
                                    }
                                    view.book.scrollTime = 1.5;
                                }
                            }
                            else if (view.activityType === namespace.Pepper.ActivityType.Exchange) {
                                if (view.selectedGameShop) {
                                    testElement(1, point, view.shopMenuBtn, isPointerDown);
                                    testShop(1, point, view.shop, isPointerDown);
                                    if (view.shop.maxOffset > 0) {
                                        if (view.shop.isDown && view.shop.hasBar) {
                                            let multiplier = 1;
                                            if (view.shop.offset < view.shop.minOffset) {
                                                multiplier = 0.35;
                                            }
                                            else if (view.shop.offset > view.shop.maxOffset) {
                                                multiplier = 0.35;
                                            }

                                            if (Math.abs(view.shop.point.y - point.y) > view.shop.rowHeight * 0.05) {
                                                view.shop.offset += (view.shop.point.y - point.y) * multiplier;
                                                view.shop.downDistance += view.shop.point.y - point.y;
                                                view.shop.point = { "x": point.x, "y": point.y };
                                                view.shop.canClick = false;
                                            }
                                        }
                                    }
                                    view.shop.scrollTime = 1.5;
                                }
                                else {
                                    testElement(1, point, view.promoBtn, isPointerDown);
                                    testStore(1, point, view.store, isPointerDown);
                                    testElement(1, point, view.gamerIdBtn, isPointerDown);
                                    if (view.store.maxOffset > 0) {
                                        if (view.store.isDown && view.store.hasBar) {
                                            let multiplier = 1;
                                            if (view.store.offset < view.store.minOffset) {
                                                multiplier = 0.35;
                                            }
                                            else if (view.store.offset > view.store.maxOffset) {
                                                multiplier = 0.35;
                                            }

                                            if (Math.abs(view.store.point.y - point.y) > view.store.rowHeight * 0.05) {
                                                view.store.offset += (view.store.point.y - point.y) * multiplier;
                                                view.store.downDistance += view.store.point.y - point.y;
                                                view.store.point = { "x": point.x, "y": point.y };
                                                view.store.canClick = false;
                                            }
                                        }
                                    }
                                    view.store.scrollTime = 1.5;
                                }
                            }
                        }
                        else {
                            testElement(1, point, view.moreBtn, isPointerDown);
                            testElement(1, point, view.chartBtn, isPointerDown);
                            if (!namespace.Core.currentAccount.watchOnly) {
                                testElement(1, point, view.sendBtn, isPointerDown);
                            }
                            testElement(1, point, view.receiveBtn, isPointerDown);
                            if (!namespace.Core.currentAccount.watchOnly) {
                                testElement(1, point, view.tradeBtn, isPointerDown);
                            }
                            testElement(1, point, view.transactionsBtn, isPointerDown);
                            testElement(1, point, view.assetsBtn, isPointerDown);
                            testElement(1, point, view.filterBtn, isPointerDown);

                            if (!namespace.Core.currentAccount.watchOnly) {
                                testElement(1, point, view.addAssetBtn, isPointerDown);
                            }

                            testList(1, point, view.list, isPointerDown);
                            if (view.list.maxOffset > 0) {
                                if (view.list.isDown && view.list.hasBar) {
                                    let multiplier = 1;
                                    if (view.list.offset < view.list.minOffset) {
                                        multiplier = 0.35;
                                    }
                                    else if (view.list.offset > view.list.maxOffset) {
                                        multiplier = 0.35;
                                    }

                                    if (Math.abs(view.list.point.y - point.y) > view.list.rowHeight * 0.05) {
                                        view.list.offset += (view.list.point.y - point.y) * multiplier;
                                        view.list.downDistance += view.list.point.y - point.y;
                                        view.list.point = { "x": point.x, "y": point.y };
                                        view.list.canClick = false;
                                    }
                                }
                            }
                            view.list.scrollTime = 1.5;
                        }
                    }
                }
            }
        }
    }

    function pointerUp(event) {
        let item, asset;
        const point = {
            "x": event.pageX * pixelRatio,
            "y": event.pageY * pixelRatio
        };

        if (namespace.Pepper.isDesktop) {
            $("#activity-view iframe").css("pointer-events", "auto");
        }

        if (rotateScreen || !view || showLoader || view.scrollerTime || view.showPinLoader) {
            return;
        }

        view.needRedraw = true;

        if (view.showModalPage) {
            testElement(2, point, view.modalPageBtn, isPointerDown, function () {
                switch (view.modalStep) {
                    case namespace.Pepper.WizardType.BackupStep1:
                        view.modalStep = namespace.Pepper.WizardType.BackupStep2;
                        view.modalPageTransitionTime = 0.3;
                        domShowVerificationForm(true);
                        break;
                    case namespace.Pepper.WizardType.BackupStep2:
                        view.modalStep = namespace.Pepper.WizardType.BackupStep3;
                        view.modalPageTransitionTime = 0.3;

                        view.mnemonicSuccess = true;
                        const words = namespace.Core.Utils.cleanMnemonic($("#words").val());
                        const memonic = words.split(" ");
                        if (memonic.length === 24) {
                            for (let i = 0; i < 24; i += 1) {
                                if (namespace.Core.currentAccount.mnemonic[i] !== memonic[i]) {
                                    view.mnemonicSuccess = false;
                                    break;
                                }
                            }
                        }
                        else {
                            view.mnemonicSuccess = false;
                        }

                        domShowVerificationForm(false);

                        if (view.mnemonicSuccess) {
                            const data = namespace.Pepper.loadWalletData();
                            data.accounts[data.lastaccount].backup = true;
                            view.account = data.accounts[data.lastaccount];
                            namespace.Pepper.saveWalletData(data);
                        }

                        break;
                    case namespace.Pepper.WizardType.BackupStep3:
                        domShowModalPage(false, namespace.Pepper.WizardType.None);
                        break;
                    case namespace.Pepper.WizardType.ViewAsset:
                        domShowAssetPage(false);
                        domShowModalPage(false, namespace.Pepper.WizardType.None);
                        break;
                    case namespace.Pepper.WizardType.ImportAccount:
                        if ($("#import").val() !== "") {
                            namespace.Pepper.importData = $("#import").val();
                            namespace.Pepper.importType = 0;

                            namespace.Core.Account.ResolveAddress(namespace.Pepper.importData, (address) => {
                                const account = new namespace.Core.Account();
                                namespace.Pepper.importData = address || namespace.Pepper.importData;
                                let publicKey = address ? 0 : account.getPublicFromMnemonic(namespace.Pepper.importData);
                                if (publicKey) {
                                    namespace.Pepper.importType = 1;
                                    namespace.Pepper.importKey = publicKey;
                                }
                                else if (StellarSdk.StrKey.isValidEd25519PublicKey(namespace.Pepper.importData)) {
                                    namespace.Pepper.importType = 2;
                                    namespace.Pepper.importKey = namespace.Pepper.importData;
                                }
                                else if (StellarSdk.StrKey.isValidEd25519SecretSeed(namespace.Pepper.importData)) {
                                    namespace.Pepper.importType = 3;
                                    namespace.Pepper.importKey = account.getPublicFromSecret(namespace.Pepper.importData);
                                }

                                if (namespace.Pepper.importType > 0) {
                                    domShowImportForm(false);
                                    domShowModalPage(false, namespace.Pepper.WizardType.None);

                                    const data = namespace.Pepper.loadWalletData();
                                    data.lastaccount = -1;
                                    namespace.Pepper.saveWalletData(data);
                                    view.resetPinPage(true);
                                }
                                else {
                                    $("#import").val("");
                                    $("#import").trigger("focus");
                                    namespace.Pepper.importData = null;
                                }
                                view.needRedraw = true;
                            });
                        }
                        else {
                            $("#import").trigger("focus");
                        }
                        break;
                }
            });

            if (view.modalStep === namespace.Pepper.WizardType.ViewAsset) {
                testElement(2, point, view.modalAddAssetBtn, isPointerDown, function () {
                    if (view.selectedAsset.hasAdd && !namespace.Pepper.queryAsset) {
                        namespace.Pepper.queryAsset = view.selectedAsset.data;
                        var stellarNet = new namespace.Core.StellarNetwork();
                        stellarNet.setTrust(
                            new StellarSdk.Asset(
                                view.selectedAsset.data.code,
                                view.selectedAsset.data.issuer),
                            (success, msg) => {
                                if (success) {
                                    domShowAssetPage(false);
                                    domShowModalPage(false, namespace.Pepper.WizardType.None);
                                }
                                else {
                                    namespace.Pepper.queryAsset = null;
                                }
                            });
                    }
                });
            }

            if (view.modalStep === namespace.Pepper.WizardType.ImportAccount) {
                testElement(2, point, view.closeModalBtn, isPointerDown, function () {
                    domShowImportForm(false);
                    domShowModalPage(false, namespace.Pepper.WizardType.None);
                });

                testElement(2, point, view.modalQrBtn, isPointerDown, function () {
                    if (window.Android) {
                        window.Android.scanQRCode();
                    }
                    else if (namespace.Pepper.isWebkitHost()) {
                        webkit.messageHandlers.callbackHandler.postMessage({ "name": "scanQRCode" });
                    }
                    else if(parent) {
                        parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[160], "*");
                    }
                });

                testElement(2, point, view.modalPasswordBtn, isPointerDown, function () {
                    domTogglePasswordVisibility();
                });
            }
        }
        else if (view.showScroller && !view.discardedPanel) {

            testElement(2, point, view.closeScrollerBtn, isPointerDown, function () {
                domShowDomainForm(false);
                domShowRenameForm(false);
                view.scrollerEndTime = 0.3;
            });

            if (!view.scrollerEndTime) {
                if (view.scroller.isDown && view.scroller.hasBar) {
                    if (Math.abs(view.scroller.point.y - point.y) > view.scroller.rowHeight * 0.2) {
                        view.scroller.offset += (view.scroller.point.y - point.y) * 0.6;
                        view.scroller.downDistance += view.scroller.point.y - point.y;
                        view.scroller.point = { "x": point.x, "y": point.y };
                    }
                }
                view.scroller.isDown = false;
                view.scroller.scrollTime = 1.5;

                if (view.scroller.type === namespace.Pepper.ScrollerType.AddAsset) {
                    if (!view.scroller.loading && !view.scroller.items.length) {
                        if (namespace.Pepper.Resources.currentSponsor) {
                            const middleY = view.scroller.y + view.unit * 0.5;
                            const size = Math.min(view.numPadArea.width, view.numPadSendBtn.y - middleY - view.unit);
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, view.numPadSendBtn.x + view.numPadSendBtn.width * 0.5 - size * 0.5, middleY, view.numPadSendBtn.x + view.numPadSendBtn.width * 0.5 - size * 0.5 + size, middleY + size)) {
                                if (namespace.Pepper.Resources.currentSponsor.issuer && namespace.Pepper.Resources.currentSponsor.code) {
                                    let asset = {
                                        "data": namespace.Core.currentAccount.assets.find(x => x.code === namespace.Pepper.Resources.currentSponsor.code && x.issuer === namespace.Pepper.Resources.currentSponsor.issuer)
                                    };
                                    if (!asset.data) {
                                        asset = {
                                            "data": new namespace.Core.Asset(namespace.Pepper.Resources.currentSponsor.issuer, namespace.Pepper.Resources.currentSponsor.code, 0, () => {
                                                domUpdateAssetPage();
                                            }),
                                            "hasAdd": true
                                        };
                                    }
                                    view.selectedAsset = asset;
                                    domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                    domShowAssetPage(true);
                                }
                                else {
                                    if (namespace.Pepper.isDesktop) {
                                        window.open(namespace.Pepper.Resources.currentSponsor.link, "_blank");
                                    }
                                    else {
                                        window.location = namespace.Pepper.Resources.currentSponsor.link;
                                    }
                                }
                            }
                        }
                    }
                }

                let noclick = true;
                const data = namespace.Pepper.loadWalletData();
                testScroller(2, point, view.scroller, isPointerDown, function (item, index) {
                    noclick = false;
                    let stellarNet = new namespace.Core.StellarNetwork();
                    if (view.scroller.canClick) {
                        switch (view.scroller.type) {
                            case namespace.Pepper.ScrollerType.Accounts:
                                if (index !== data.lastaccount) {
                                    data.lastaccount = index;
                                    namespace.Pepper.saveWalletData(data);
                                    showLoader = true;
                                    loaderTime = 0.5;
                                    loaderText = namespace.Pepper.Resources.localeText[18];
                                    setTimeout(() => {
                                        view.resetPinPage(false);
                                        showLoader = false;
                                        view.scrollerEndTime = 0.0001;
                                        view.needRedraw = true;
                                    }, 500);
                                }
                                break;
                            case namespace.Pepper.ScrollerType.Languages:
                                if (item.languageId !== namespace.Pepper.Resources.languageId) {
                                    showLoader = true;
                                    loaderTime = 0.5;
                                    view.setupLanguage(item.languageId, () => {
                                        showLoader = false;
                                        view.scrollerEndTime = 0.3;
                                        view.needRedraw = true;
                                        domUpdateLanguage();
                                    });
                                    loaderText = namespace.Pepper.Resources.localeText[15];
                                }
                                break;
                            case namespace.Pepper.ScrollerType.Addresses:
                                $("#address").val(item.id);
                                showLoader = false;
                                view.scrollerEndTime = 0.3;
                                break;
                            case namespace.Pepper.ScrollerType.AccountSettings:
                                if (item.id !== view.scroller.items.length - 1 && view.deleteStep) {
                                    view.deleteStep = 0;
                                    view.scroller.items[view.scroller.items.length - 1].label = namespace.Pepper.Resources.localeText[141];
                                }
                                else if ($("#rename-form").is(":visible")) {
                                    domShowRenameForm(false);
                                }
                                else {
                                    if (item.id === 0) {
                                        domShowRenameForm(true);
                                    }
                                    else if (item.id === 1) {
                                        view.loadScroller(namespace.Pepper.ScrollerType.Currencies);
                                        view.isDashboardMenu = false;
                                    }
                                    else if (item.id === 2) {
                                        data.accounts[data.lastaccount].nonotif = !data.accounts[data.lastaccount].nonotif;
                                        view.account = data.accounts[data.lastaccount];
                                        namespace.Pepper.saveWalletData(data);
                                    }
                                    else if (item.id === 3) {
                                        data.accounts[data.lastaccount].notoast = !data.accounts[data.lastaccount].notoast;
                                        view.account = data.accounts[data.lastaccount];
                                        namespace.Pepper.saveWalletData(data);
                                    }
                                    else if (item.id === 4) {
                                        if (!namespace.Core.currentAccount.friendlyAddress &&
                                            !namespace.Core.currentAccount.watchOnly) {
                                                domShowGetFriendlyPage();
                                        }
                                        else if(namespace.Core.currentAccount.friendlyAddress) {
                                            if (window.Android) {
                                                window.Android.copyToClipboard("address", namespace.Core.currentAccount.friendlyAddress, namespace.Pepper.Resources.localeText[122]);
                                            }
                                            else if (namespace.Pepper.isWebkitHost()) {
                                                webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "address", "data": namespace.Core.currentAccount.friendlyAddress, "message": namespace.Pepper.Resources.localeText[122] });
                                            }
                                            else {
                                                namespace.Pepper.copyToClipboard(namespace.Core.currentAccount.friendlyAddress, namespace.Pepper.Resources.localeText[122]);
                                            }
                                        }
                                    }
                                    else if (item.id === view.scroller.items.length - 2) {
                                        if (!namespace.Core.currentAccount.nobackup) {
                                            view.closeSendPage(() => {
                                                domShowAddressForm(false);
                                                domShowTradeForm(false);
                                            });
                                            domShowModalPage(true, namespace.Pepper.WizardType.BackupStep1);
                                        }
                                    }
                                    else if (item.id === view.scroller.items.length - 1) {
                                        if (view.deleteStep === 3) {
                                            setTimeout(function () {
                                                data.accounts.splice(data.lastaccount, 1);
                                                data.lastaccount = -1;
                                                namespace.Pepper.saveWalletData(data);
                                                view.closeSendPage(() => {
                                                    domShowAddressForm(false);
                                                    domShowTradeForm(false);
                                                }, true);
                                                namespace.Core.currentAccount.unload(signOutCb);
                                                view.scrollerEndTime = 0.1;
                                            }, 300);
                                        }
                                        view.deleteStep += 1;
                                        if (view.deleteStep > 4) {
                                            view.deleteStep = 4;
                                        }
                                        item.label = namespace.Pepper.Resources.localeText[141 + view.deleteStep];
                                    }

                                    if (item.id !== 0) {
                                        domShowRenameForm(false);
                                    }
                                }
                                break;
                            case namespace.Pepper.ScrollerType.Currencies:
                                if (item.id !== "") {
                                    const data = namespace.Pepper.loadWalletData();
                                    data.accounts[data.lastaccount].currency = item.id;
                                    view.account = data.accounts[data.lastaccount];
                                    namespace.Pepper.saveWalletData(data);
                                }
                                view.scrollerEndTime = 0.1;
                                break;
                            case namespace.Pepper.ScrollerType.Assets:
                                if (item.id !== view.carousel.active) {
                                    view.setActiveCarouselItem(item.id);
                                }
                                view.scrollerEndTime = 0.1;

                                if (view.isActivityMode) {
                                    if (view.activityType === namespace.Pepper.ActivityType.Trade) {
                                        domShowTradeForm(true);
                                    }
                                }

                                break;
                            case namespace.Pepper.ScrollerType.ShopConfirm:
                                if (item.id === 3) {
                                    view.selectedBuyItem.ready = false;
                                    if (!view.selectedBuyItem.buying && !view.selectedBuyItem.failed && !view.selectedBuyItem.success) {
                                        view.selectedBuyItem.buying = true;

                                        let destAccount = view.selectedGameShop.data.shop.account;
                                        let destCode = view.selectedGameShop.data.shop.code;
                                        let destIssuer = view.selectedGameShop.data.shop.issuer;
                                        let destPrice = namespace.Pepper.Tools.formatPrice(view.selectedBuyItem.data.price);
                                        if (view.selectedBuyItem.data.collectible) {
                                            destAccount = namespace.Core.currentAccount.keys.publicKey();
                                            destCode = view.selectedBuyItem.data.code;
                                            destIssuer = view.selectedBuyItem.data.issuer;
                                            destPrice = namespace.Pepper.Tools.formatPrice(view.selectedBuyItem.data.priceScale || 1);
                                        }

                                        let base = view.getActiveCarouselItem().asset;
                                        stellarNet.sendPathPayment(
                                            view.selectedBuyItem.data.id,
                                            base.code,
                                            base.issuer,
                                            view.selectedBuyItem.data.orderPrice,
                                            destCode,
                                            destIssuer,
                                            destPrice,
                                            destAccount,
                                            view.selectedBuyItem.data.path,
                                            (success, message) => {
                                                view.selectedBuyItem.buying = false;
                                                if (success) {
                                                    view.selectedBuyItem.success = true;
                                                }
                                                else {
                                                    view.selectedBuyItem.error = {
                                                        error: true,
                                                        status: message.response && message.response.data
                                                            && message.response.data.extras
                                                            && message.response.data.extras.result_codes
                                                            && message.response.data.extras.result_codes.operations
                                                            ? message.response.data.extras.result_codes.operations : message.response && message.response.data ? message.response.data.title : ""
                                                    };
                                                    console.log(view.selectedBuyItem.error);
                                                    console.log(message);
                                                }
                                            });

                                            if (gtag) {
                                                gtag("event", "click", { "event_category": "app", "event_label": "buy" });
                                            }
                                    }
                                }
                                break;
                            case namespace.Pepper.ScrollerType.AddAsset:
                                if (!item.data.balance && item.overAddBtn && !namespace.Pepper.queryAsset && item.hasAdd) {
                                    item.overAddBtn = false;
                                    namespace.Pepper.queryAsset = item.data;
                                    stellarNet.setTrust(
                                        new StellarSdk.Asset(
                                            item.data.code,
                                            item.data.issuer),
                                        (success, msg) => {
                                            if (!success) {
                                                namespace.Pepper.queryAsset = null;
                                                console.log(msg);
                                            }
                                        });
                                }
                                else {
                                    view.selectedAsset = item;
                                    domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                    domShowAssetPage(true);
                                }
                                item.overAddBtn = false;
                                break;
                            case namespace.Pepper.ScrollerType.ShopMenu:
                                view.scrollerEndTime = 0.1;
                                switch (item.id) {
                                    case 1:
                                        if (namespace.Pepper.isDesktop) {
                                            window.open(view.selectedGameShop.data.shop.website, "_blank");
                                        }
                                        else {
                                            window.location = view.selectedGameShop.data.shop.website;
                                        }                                       
                                        break;
                                    case 2:
                                        if (namespace.Pepper.isDesktop) {
                                            window.open(view.selectedGameShop.data.shop.terms, "_blank");
                                        }
                                        else {
                                            window.location = view.selectedGameShop.data.shop.terms;
                                        }    
                                        break;
                                    case 3:
                                        if (namespace.Pepper.isDesktop) {
                                            window.open(view.selectedGameShop.data.shop.privacy, "_blank");
                                        }
                                        else {
                                            window.location = view.selectedGameShop.data.shop.privacy;
                                        } 
                                        break;
                                    case 4:
                                        view.selectedGameShop = null;
                                        view.shopTime = 0.3;
                                        break;
                                }
                                //view.selectedGameShop.data.shop.account
                                break;
                            case namespace.Pepper.ScrollerType.AssetsMenu:
                                if (item.enabled) {
                                    view.scrollerEndTime = 0.1;
                                    let carouselitem = view.getActiveCarouselItem();
                                    switch (item.id) {
                                        case 1:
                                            if (carouselitem) {
                                                let asset = {
                                                    "data": namespace.Core.currentAccount.assets.find(x => x.code === carouselitem.asset.code && x.issuer === carouselitem.asset.issuer)
                                                };
                                                if (asset.data) {
                                                    view.selectedAsset = asset;
                                                    domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                                    domShowAssetPage(true);
                                                }
                                                else {
                                                    asset.data = view.placeHolderAsset.asset;
                                                    view.selectedAsset = asset;
                                                    domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                                    domShowAssetPage(true);
                                                }
                                            }
                                            break;
                                        case 2:
                                            loadChart();
                                            break;
                                        case 3:
                                            if (carouselitem && carouselitem.asset) {
                                                if (window.Android) {
                                                    window.Android.share(
                                                        namespace.Pepper.Resources.localeText[126] + " " + carouselitem.asset.code,
                                                        namespace.Pepper.Resources.localeText[133] + " " + carouselitem.asset.issuer,
                                                        namespace.Pepper.Resources.localeText[134] + " " + (carouselitem.asset.deposit || namespace.Core.currentAccount.keys.publicKey()),
                                                        namespace.Pepper.Resources.localeText[135]);
                                                }
                                                else if (namespace.Pepper.isWebkitHost()) {
                                                    webkit.messageHandlers.callbackHandler.postMessage({
                                                        "name": "share",
                                                        "code": namespace.Pepper.Resources.localeText[126] + " " + carouselitem.asset.code,
                                                        "issuer": namespace.Pepper.Resources.localeText[133] + " " + carouselitem.asset.issuer,
                                                        "deposit": namespace.Pepper.Resources.localeText[134] + " " + (carouselitem.asset.deposit || namespace.Core.currentAccount.keys.publicKey()),
                                                        "title": namespace.Pepper.Resources.localeText[135]
                                                    });
                                                }
                                                else {
                                                    namespace.Pepper.copyToClipboard(
                                                        namespace.Pepper.Resources.localeText[126] + " " + carouselitem.asset.code + "\n" +
                                                        namespace.Pepper.Resources.localeText[133] + " " + carouselitem.asset.issuer + "\n" +
                                                        namespace.Pepper.Resources.localeText[134] + " " + (carouselitem.asset.deposit || namespace.Core.currentAccount.keys.publicKey()), 
                                                    namespace.Pepper.Resources.localeText[122]);
                                                }
                                            }
                                            break;
                                        case 4:
                                            if (carouselitem && carouselitem.asset) {
                                                if (namespace.Pepper.isDesktop) {
                                                    window.open("https://" + carouselitem.asset.domain, "_blank");
                                                }
                                                else {
                                                    window.location = "https://" + carouselitem.asset.domain;
                                                }
                                            }
                                            break;
                                        case 5:
                                            if (carouselitem && carouselitem.asset) {
                                                carouselitem.asset.loaded = false;
                                                namespace.Pepper.queryAsset = carouselitem.asset;
                                                stellarNet.removeTrust(
                                                    new StellarSdk.Asset(carouselitem.asset.code, carouselitem.asset.issuer),
                                                    (success, msg) => {
                                                        if (success) {
                                                            // Clear quote asset if needed.
                                                            const propId = view.carousel.items[0].asset.code + view.carousel.items[0].asset.issuer;
                                                            const quote = view.quoteAssets[propId];
                                                            if (quote && quote.code === carouselitem.asset.code && quote.issuer === carouselitem.asset.issuer) {
                                                                view.quoteAssets[propId] = null;
                                                            }
                                                        }
                                                        else {
                                                            carouselitem.asset.loaded = true;
                                                            namespace.Pepper.queryAsset = null;
                                                            console.log(JSON.stringify(msg));
                                                        }
                                                    });
                                            }
                                            break;
                                    }
                                }
                                break;
                            case namespace.Pepper.ScrollerType.LastTrades:
                                if (item.data) {
                                    updateTradeInputs(
                                        namespace.Pepper.Tools.formatPrice(
                                            namespace.Pepper.Tools.rationalPriceToDecimal(item.data.price)));
                                }
                                break;
                            case namespace.Pepper.ScrollerType.Leaderboard:
                                const hasChallenge = view.selectedGame && view.selectedGame.data && view.selectedGame.data.challenge;
                                if (hasChallenge) {
                                    switch (item.id) {
                                        case 0:
                                        case 1:
                                        case 2:
                                            let selectedAsset = view.selectedGame.data.challenge.assets[item.id];
                                            if (selectedAsset) {
                                                let issuer = selectedAsset.issuer || "native";
                                                let asset = {
                                                    "data": namespace.Core.currentAccount.assets.find(x => x.code === selectedAsset.code && x.issuer === issuer)
                                                };
                                                if (!asset.data) {
                                                    let nativeAsset = namespace.Core.currentAccount.assets.find(x => x.code === "XLM" && x.issuer === "native");
                                                    let canAdd = nativeAsset && namespace.Core.currentAccount.assets.length
                                                        && namespace.Core.currentAccount.getMaxSend(nativeAsset.balance, nativeAsset) >= namespace.Core.currentAccount.getTrustBaseFee()
                                                        ? true : false;
                                                    asset = {
                                                        "data": new namespace.Core.Asset(issuer, selectedAsset.code, 0, () => {
                                                            domUpdateAssetPage();
                                                        }),
                                                        "hasAdd": canAdd
                                                    };
                                                }
                                                view.selectedAsset = asset;
                                                domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                                domShowAssetPage(true);
                                            }
                                            break;
                                        case 3:
                                            if (view.selectedGame.data.challenge.link) {
                                                if (namespace.Pepper.isDesktop) {
                                                    window.open(view.selectedGame.data.challenge.link, "_blank");
                                                }
                                                else {
                                                    window.location = view.selectedGame.data.challenge.link;
                                                }
                                            }
                                            break;
                                    }
                                }
                                break;
                            case namespace.Pepper.ScrollerType.CoinSwap:
                                if (item.id === 5 && namespace.Pepper.coinSwitch.coinBtnId && !namespace.Pepper.coinSwitch.loading) {
                                    let amountBtnId = namespace.Pepper.coinSwitch.amountBtnId || 1;
                                    let code = namespace.Pepper.coinSwitch.currencies[namespace.Pepper.coinSwitch.coinBtnId - 1].code.toLowerCase();
                                    let amount = (namespace.Pepper.coinSwitch.minDeposit * amountBtnId).toFixed(namespace.Pepper.coinSwitch.coinBtnId === 1 ? 3 : 2);
                                    namespace.Pepper.coinSwitch.loading = true;
                                    $.post( namespace.config.apiUrl + "/.coinswitch/order", { from: code, address: namespace.Core.currentAccount.keys.publicKey(), amount: amount })
                                        .done(function( response ) {
                                            namespace.Pepper.coinSwitch.loading = false;
                                            if (response) {
                                                let payload = JSON.parse(response);
                                                if(payload.success && payload.data) {
                                                    let url = "https://exchange.litemint.com/order/" + payload.data.orderId
                                                    if (namespace.Pepper.isDesktop) {
                                                        window.open(url, "_blank");
                                                    }
                                                    else {
                                                        window.location = url;
                                                    }
                                                    view.scrollerEndTime = 0.3;
                                                }
                                            }
                                        })
                                        .fail(function(xhr, status, error) {
                                            namespace.Pepper.coinSwitch.loading = false;
                                        });
                                }
                                else if (item.id === 4 && namespace.Pepper.coinSwitch.coinBtnId && !namespace.Pepper.coinSwitch.loading) {
                                    let btnWidth = item.width / 5;
                                    let amountBtnId = Math.ceil((point.x - item.x) / btnWidth);
                                    if (amountBtnId !== 5) {
                                        namespace.Pepper.coinSwitch.amountBtnId = amountBtnId;
                                    }
                                    else {
                                        let btnId = namespace.Pepper.coinSwitch.coinBtnId || 1;
                                        let code = namespace.Pepper.coinSwitch.currencies[btnId - 1].code.toLowerCase();
                                        let url = "https://exchange.litemint.com/?from="+ code + "&to=xlm&address=" + namespace.Core.currentAccount.keys.publicKey();
                                        if (namespace.Pepper.isDesktop) {
                                            window.open(url, "_blank");
                                        }
                                        else {
                                            window.location = url;
                                        }
                                    }
                                }
                                else if (item.id === 2) {
                                    let btnWidth = item.width / 5;
                                    let coinBtnId = Math.ceil((point.x - item.x) / btnWidth);
                                    if (coinBtnId !== 5) {
                                        if(!namespace.Pepper.coinSwitch.loading && namespace.Pepper.coinSwitch.coinBtnId !== coinBtnId){
                                            namespace.Pepper.coinSwitch.coinBtnId = coinBtnId;
                                            namespace.Pepper.coinSwitch.loading = true;
                                            const getSwapRates = function () {
                                                let code = namespace.Pepper.coinSwitch.currencies[namespace.Pepper.coinSwitch.coinBtnId - 1].code.toLowerCase();
                                                $.post( namespace.config.apiUrl + "/.coinswitch/rate", { from: code })
                                                    .done(function( response ) {
                                                        namespace.Pepper.coinSwitch.loading = false;
                                                        view.setupTime = 0.5;
                                                        if (response) {
                                                            let payload = JSON.parse(response);
                                                            if (payload.success && payload.data && payload.data.limitMinDestinationCoin) {
                                                                console.log(payload.data);
                                                                namespace.Pepper.coinSwitch.rate = payload.data.rate;
                                                                namespace.Pepper.coinSwitch.minDeposit = (payload.data.limitMinDepositCoin * 2).toFixed(namespace.Pepper.coinSwitch.coinBtnId === 1 ? 3 : 2);
                                                            }
                                                        }
                                                    })
                                                    .fail(function(xhr, status, error) {
                                                        namespace.Pepper.coinSwitch.loading = false;
                                                    });
                                            };
                                            getSwapRates();
                                        }
                                    }
                                    else {
                                        let btnId = namespace.Pepper.coinSwitch.coinBtnId || 1;
                                        let code = namespace.Pepper.coinSwitch.currencies[btnId - 1].code.toLowerCase();
                                        let url = "https://exchange.litemint.com/?from="+ code + "&to=xlm&address=" + namespace.Core.currentAccount.keys.publicKey();
                                        if (namespace.Pepper.isDesktop) {
                                            window.open(url, "_blank");
                                        }
                                        else {
                                            window.location = url;
                                        }
                                    }

                                }
                                break;
                            case namespace.Pepper.ScrollerType.LiveOrders:
                                if (!view.cancellingOffer) {
                                    for (let v = 0; v < view.scroller.items.length; v += 1) {
                                        if (v !== item.id) {
                                            if (view.scroller.items[v].delete) {
                                                view.scroller.items[v].slideTime = 0.3;
                                            }
                                            view.scroller.items[v].delete = false;
                                        }
                                    }

                                    let offer = view.scroller.items[item.id];
                                    const isConfirmed = point.x > offer.x + offer.width - view.unit * 13 * 0.3;
                                    if (offer.delete && isConfirmed) {
                                        view.cancellingOffer = offer.data.id;
                                        stellarNet.cancelOffer(offer.data, (success, message) => {
                                            if (!success) {
                                                console.error(message);
                                                view.cancellingOffer = 0;
                                            }
                                        });
                                    }
                                    else if (offer.delete && !isConfirmed) {
                                        offer.delete = false;
                                        offer.slideTime = 0.3;
                                    }
                                    else {
                                        offer.delete = true;
                                        offer.slideTime = 0.3;
                                    }
                                }
                                break;
                            case namespace.Pepper.ScrollerType.QuotesMenu:
                                view.scrollerEndTime = 0.3;
                                view.discardedPanel = true;

                                if (item.asset) {
                                    let activeItem = view.getActiveCarouselItem();
                                    view.quoteAssets[activeItem.asset.code + activeItem.asset.issuer] = item.asset;
                                    loadOrderBook(true);
                                    domShowTradeForm(true);
                                }
                                else {
                                    view.closeSendPage(() => {
                                        domShowAddressForm(false);
                                        domShowTradeForm(false);
                                    });
                                    view.resetList(namespace.Pepper.ListType.Assets);
                                    reloadAssets();
                                }
                                break;
                            case namespace.Pepper.ScrollerType.FilterMenu:
                                view.account.filters[item.id] = !view.account.filters[item.id];
                                item.time = 0.25;

                                data.accounts[data.lastaccount].filters = view.account.filters.slice();
                                namespace.Pepper.saveWalletData(data);

                                if (view.tabId === 1) {
                                    view.resetList(namespace.Pepper.ListType.Assets);
                                    reloadAssets();
                                }
                                else {
                                    view.resetList(namespace.Pepper.ListType.Transactions);
                                    reloadAccountOperations();
                                }
                                break;
                        }
                    }
                });

                if (noclick) {
                    if (view.scroller.type === namespace.Pepper.ScrollerType.LiveOrders) {
                        if (!view.cancellingOffer) {
                            for (let v = 0; v < view.scroller.items.length; v += 1) {
                                if (view.scroller.items[v].delete) {
                                    view.scroller.items[v].slideTime = 0.3;
                                }
                                view.scroller.items[v].delete = false;
                            }
                        }
                    }
                }
            }
        }
        else {
            if (view.page === namespace.Pepper.PageType.SignUp || view.page === namespace.Pepper.PageType.SignIn && !view.discardedPanel) {
                if (!view.isPinMenu) {
                    const wasZero = view.pinCode.length === 0 ? true : false;
                    const wasError = view.pinError;

                    for (let i = 0; i < view.numPad.length; i += 1) {
                        item = view.numPad[i];
                        testElement(2, point, item, isPointerDown, function () {
                            view.pinError = false;
                            if (item.id === 11) {
                                if (view.pinCode.length > 0) {
                                    view.pinCode.splice(-1, 1);
                                }
                            }
                            else if (item.id === 12) {
                                view.numPadOrder = namespace.Core.Utils.secureShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
                            }
                            else if (view.pinCode.length < view.pinMax) {
                                view.pinCode.push(item.id);
                            }

                            if (wasZero && wasError && view.pinCode.length && view.pinStep === 0 && view.page === namespace.Pepper.PageType.SignUp) {
                                view.pinMsgTime = 0.5;
                            }
                        });
                    }

                    testElement(2, point, view.pinBtn, isPointerDown, function () {
                        if (view.pinCode.length >= view.pinMin) {
                            switch (view.pinStep) {
                                case 0:
                                    if (view.page === namespace.Pepper.PageType.SignUp) {
                                        view.pinStep += 1;
                                        view.pinCodeCheck = view.pinCode.slice();
                                        view.pinCode = [];
                                    }
                                    else {
                                        view.showPinLoader = true;
                                        setTimeout(() => {
                                            if (!namespace.Core.currentAccount.load(view.pinCode, {
                                                "load": namespace.Pepper.loadWalletData,
                                                "save": namespace.Pepper.saveWalletData
                                            })) {
                                                view.showPinLoader = false;
                                                view.pinError = true;
                                                view.pinErrorTime = 1;
                                                view.pinStep = 0;
                                                view.pinCode = [];
                                                view.pinCodeCheck = [];
                                            }
                                            else {
                                                showLoader = true;
                                                loaderTime = 0.5;
                                                loaderText = namespace.Pepper.Resources.localeText[16];
                                                setTimeout(() => {
                                                    signIn((error) => {
                                                        view.dashboardTime = 0.3;
                                                        view.showPinLoader = false;
                                                        showLoader = false;
                                                        view.needRedraw = true;
                                                        handleSignInError(error);
                                                    });
                                                }, 500);
                                            }
                                        }, 500);
                                    }
                                    break;
                                case 1:
                                    if (view.page === namespace.Pepper.PageType.SignUp) {
                                        if (!namespace.Core.Utils.bytesEqual(view.pinCode, view.pinCodeCheck,
                                            Math.max(view.pinCode.length, view.pinCodeCheck.length))) {
                                            view.pinError = true;
                                            view.pinErrorTime = 1;
                                            view.pinStep = 0;
                                            view.pinCode = [];
                                            view.pinCodeCheck = [];
                                        }
                                        else {
                                            view.showPinLoader = true;
                                            setTimeout(() => {
                                                loaderTime = 0.5;
                                                showLoader = true;
                                                loaderText = namespace.Pepper.Resources.localeText[16];
                                                const data = namespace.Pepper.loadWalletData();
                                                namespace.Core.currentAccount.create(
                                                    view.pinCode,
                                                    namespace.Pepper.Resources.localeText[17] + "-" + ("000" + (data.accounts.length + 1)).substr(-3),
                                                    false, {
                                                        "load": namespace.Pepper.loadWalletData,
                                                        "save": namespace.Pepper.saveWalletData
                                                    }, namespace.Pepper.importData);

                                                namespace.Pepper.importData = null;
                                                namespace.Pepper.importType = 0;
                                                namespace.Pepper.importKey = null;

                                                signIn((error) => {
                                                    view.dashboardTime = 0.3;
                                                    view.showPinLoader = false;
                                                    view.needRedraw = true;
                                                    showLoader = false;
                                                    handleSignInError(error);
                                                });
                                            }, 500);
                                        }
                                    }
                                    break;
                            }
                        }
                    });

                    testElement(2, point, view.pinMenuBtn, isPointerDown, function () {
                        view.isPinMenu = true;
                    });

                    testElement(2, point, view.pinSwitchBtn, isPointerDown, function () {
                        view.loadScroller(namespace.Pepper.ScrollerType.Accounts);
                    });
                }
                else {
                    for (let i = 0; i < view.pinMenu.length; i += 1) {
                        testElement(2, point, view.pinMenu[i], isPointerDown, function () {
                            switch (view.pinMenu[i].id) {
                                case 0:
                                    namespace.Pepper.importData = null;
                                    namespace.Pepper.importType = 0;
                                    namespace.Pepper.importKey = null;

                                    view.loadScroller(namespace.Pepper.ScrollerType.Accounts);
                                    break;
                                case 1:
                                    namespace.Pepper.importData = null;
                                    namespace.Pepper.importType = 0;
                                    namespace.Pepper.importKey = null;

                                    const data = namespace.Pepper.loadWalletData();
                                    data.lastaccount = -1;
                                    namespace.Pepper.saveWalletData(data);
                                    view.resetPinPage(true);
                                    break;
                                case 2:
                                    namespace.Pepper.importData = null;
                                    namespace.Pepper.importType = 0;
                                    namespace.Pepper.importKey = null;

                                    domShowModalPage(true, namespace.Pepper.WizardType.ImportAccount);
                                    domShowImportForm(true);
                                    break;
                                case 3:
                                    view.loadScroller(namespace.Pepper.ScrollerType.Languages);
                                    break;
                                case 4:
                                    domShowAboutPage(true, 0);
                                    break;
                            }
                        });
                    }
                }
            }
            else if (view.page === namespace.Pepper.PageType.Dashboard) {
                if (view.isDashboardMenu) {
                    for (let i = 0; i < view.dashboardMenu.length; i += 1) {
                        testElement(2, point, view.dashboardMenu[i], isPointerDown, function () {
                            switch (view.dashboardMenu[i].id) {
                                case 0:
                                    // Manage account.
                                    view.loadScroller(namespace.Pepper.ScrollerType.AccountSettings);
                                    break;
                                case 1:
                                    view.isDashboardMenu = false;
                                    if (view.isActivityMode) {
                                        view.closeSendPage(() => {
                                            domShowAddressForm(false);
                                            domShowTradeForm(false);
                                            showMarketplace();
                                        });
                                    }
                                    else {
                                        showMarketplace();
                                    }
                                    break;
                                case 2:
                                    view.loadScroller(namespace.Pepper.ScrollerType.Languages);
                                    break;
                                case 3:
                                    domShowAboutPage(true);
                                    break;
                                case 4:
                                    view.closeSendPage(() => {
                                        domShowAddressForm(false);
                                        domShowTradeForm(false);
                                    }, true);
                                    namespace.Core.currentAccount.unload(signOutCb);
                                    break;
                            }
                        });
                    }
                }
                else {
                    let called = false;
                    if (view.carousel.clicked) {
                        if (view.carousel.isDown && view.carousel.hasBar) {
                            if (Math.abs(view.carousel.point.x - point.x) > view.carousel.colWidth * 0.03) {
                                view.carousel.offset += (view.carousel.point.x - point.x) * 0.6;
                                view.carousel.downDistance += view.carousel.point.x - point.x;
                                view.carousel.point = { "x": point.x, "y": point.y };
                            }
                        }

                        testCarousel(2, point, view.carousel, isPointerDown, function (item, index) {
                            if (!called && view.carousel.canClick) {
                                called = true;
                                if (item === view.getActiveCarouselItem()) {
                                    if (view.isActivityMode) {
                                        if (view.activityType === namespace.Pepper.ActivityType.SelectSendAmount) {
                                            let amount = namespace.Core.currentAccount.getMaxSend(view.getActiveCarouselItem().asset.balance, view.getActiveCarouselItem().asset);
                                            if (amount > 0) {
                                                view.sendAmount = namespace.Pepper.Tools.formatPrice(amount);
                                            }
                                        }
                                        else if (view.activityType === namespace.Pepper.ActivityType.Trade) {
                                            if (point.x < item.x + item.width * 0.5 - view.carousel.offset) {
                                                let amount = namespace.Core.currentAccount.getMaxSend(view.getActiveCarouselItem().asset.balance, view.getActiveCarouselItem().asset);
                                                if (amount > 0) {
                                                    updateTradeInputs(null, namespace.Pepper.Tools.formatPrice(amount));
                                                }
                                            }
                                            else {
                                                let base = view.getActiveCarouselItem().asset;
                                                let quote = view.quoteAssets[base.code + base.issuer];
                                                if (quote) {
                                                    let amount = namespace.Core.currentAccount.getMaxSend(quote.balance, quote);
                                                    if (amount > 0) {
                                                        updateTradeInputs(null, null, namespace.Pepper.Tools.formatPrice(amount));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                    else {
                        if (!namespace.Core.currentAccount.watchOnly) {
                            testElement(2, point, view.sendBtn, isPointerDown, function () {
                                if (!called) {
                                    called = true;
                                    view.activityType = namespace.Pepper.ActivityType.SelectSendAmount;
                                    view.isActivityMode = true;
                                    view.sendAmount = "";
                                    view.sendFormTime = 0.5;
                                    view.rotateSponsor();

                                    for (let i = 0; i < view.carousel.items.length; i += 1) {
                                        if (view.carousel.items[i].chartMode) {
                                            view.carousel.items[i].chartMode = false;
                                            view.carousel.items[i].transitionTime = 0.5;
                                        }
                                    }

                                    if (view.placeHolderAsset) {
                                        view.placeHolderAsset.chartMode = false;
                                        view.placeHolderAsset.transitionTime = 0.5;
                                    }
                                }
                            });
                        }

                        testElement(2, point, view.receiveBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                view.activityType = namespace.Pepper.ActivityType.Receive;
                                view.isActivityMode = true;
                                view.sendFormTime = 0.5;

                                domGenerateCode();

                                for (let i = 0; i < view.carousel.items.length; i += 1) {
                                    if (view.carousel.items[i].chartMode) {
                                        view.carousel.items[i].chartMode = false;
                                        view.carousel.items[i].transitionTime = 0.5;
                                    }
                                }

                                if (view.placeHolderAsset) {
                                    view.placeHolderAsset.chartMode = false;
                                    view.placeHolderAsset.transitionTime = 0.5;
                                }
                            }
                        });

                        if (!namespace.Core.currentAccount.watchOnly) {
                            testElement(2, point, view.tradeBtn, isPointerDown, function () {
                                if (!called) {
                                    called = true;
                                    view.activityType = namespace.Pepper.ActivityType.Trade;
                                    view.isActivityMode = true;
                                    view.sendFormTime = 0.5;
                                    loadOrderBook(true);
                                    domGenerateCode();
                                    domShowTradeForm(true, true);

                                    for (let i = 0; i < view.carousel.items.length; i += 1) {
                                        if (view.carousel.items[i].chartMode) {
                                            view.carousel.items[i].chartMode = false;
                                            view.carousel.items[i].transitionTime = 0.5;
                                        }
                                    }

                                    if (view.placeHolderAsset) {
                                        view.placeHolderAsset.chartMode = false;
                                        view.placeHolderAsset.transitionTime = 0.5;
                                    }
                                }
                            });
                        }

                        testElement(2, point, view.assetPicker, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                view.loadScroller(namespace.Pepper.ScrollerType.Assets);
                                domShowTradeForm(false);
                            }
                        });

                        testElement(2, point, view.menuBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                view.isDashboardMenu = true;
                                view.closeSendPage(() => {
                                    domShowAddressForm(false);
                                    domShowTradeForm(false);
                                }, true);
                            }
                        });

                        testElement(2, point, view.accountBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;

                                if (!namespace.Core.currentAccount.friendlyAddress) {
                                    namespace.Core.Account.ResolveAccount(namespace.Core.currentAccount.keys.publicKey(), "litemint.com", (addr) => {
                                        namespace.Core.currentAccount.friendlyAddress = addr;
                                        view.needRedraw = true;
                                    });
                                }

                                view.closeSendPage(() => {
                                    domShowAddressForm(false);
                                    domShowTradeForm(false);
                                });
                                view.loadScroller(namespace.Pepper.ScrollerType.AccountSettings);
                            }
                        });

                        if (!namespace.Core.currentAccount.watchOnly) {
                            testElement(2, point, view.marketBtn, isPointerDown, function () {
                                if (!called) {
                                    called = true;
                                    if (view.isActivityMode) {
                                        view.closeSendPage(() => {
                                            domShowAddressForm(false);
                                            domShowTradeForm(false);
                                            showMarketplace();
                                        });
                                    }
                                    else {
                                        showMarketplace();
                                    }
                                }
                            });
                        }

                        if (!namespace.Core.currentAccount.watchOnly) {
                            testElement(2, point, view.addAssetBtn, isPointerDown, function () {
                                if (!called) {
                                    called = true;
                                    view.rotateSponsor();
                                    view.loadScroller(namespace.Pepper.ScrollerType.AddAsset);
                                    domShowDomainForm(true);
                                }
                            });
                        }

                        testElement(2, point, view.filterBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                view.loadScroller(namespace.Pepper.ScrollerType.FilterMenu);
                            }
                        });

                        testElement(2, point, view.transactionsBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                if (view.tabId !== 0) {
                                    view.resetList(namespace.Pepper.ListType.Transactions);
                                    reloadAccountOperations();
                                }
                            }
                        });

                        testElement(2, point, view.assetsBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                if (view.tabId !== 1) {
                                    view.resetList(namespace.Pepper.ListType.Assets);
                                    reloadAssets();
                                }
                            }
                        });

                        testElement(2, point, view.moreBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                item = view.getActiveCarouselItem();
                                if (item.chartMode) {
                                    item.chartMode = false;
                                    item.transitionTime = 0.5;
                                }
                                else {
                                    view.loadScroller(namespace.Pepper.ScrollerType.AssetsMenu);
                                }
                            }
                        });

                        testElement(2, point, view.chartBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                loadChart();
                            }
                        });

                        if (!called) {
                            if (view.isActivityMode) {

                                testElement(2, point, view.quoteBtn, isPointerDown, function () {
                                    domShowTradeForm(false);
                                    view.loadScroller(namespace.Pepper.ScrollerType.QuotesMenu);
                                });

                                let close = false;
                                testElement(2, point, view.numPadCloseBtn, isPointerDown, function () {
                                    if (view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Exchange && view.selectedGameShop) {
                                        view.selectedGameShop = null;
                                        view.shopTime = 0.3;
                                    }
                                    else {
                                        view.closeSendPage(() => {
                                            domShowAddressForm(false);
                                            domShowTradeForm(false);
                                        });
                                        close = true;
                                    }
                                });

                                if (view.activityType === namespace.Pepper.ActivityType.ConfirmSend && view.isActivityMode && view.numPad.length) {
                                    if (namespace.Pepper.Resources.currentSponsor) {
                                        const middleY = view.carousel.y + view.carousel.height + view.unit * 0.1 + (view.numPad[0].y - (view.carousel.y + view.carousel.height + view.unit * 0.1)) * 0.5 - view.unit * 0.7;
                                        const size = Math.min(view.numPadArea.width, view.numPadSendBtn.y - middleY - view.unit);
                                        if (namespace.Pepper.Tools.pointInRect(point.x, point.y, view.numPadSendBtn.x + view.numPadSendBtn.width * 0.5 - size * 0.5, middleY, view.numPadSendBtn.x + view.numPadSendBtn.width * 0.5 - size * 0.5 + size, middleY + size)) {
                                            if (namespace.Pepper.Resources.currentSponsor.issuer && namespace.Pepper.Resources.currentSponsor.code) {
                                                let asset = {
                                                    "data": namespace.Core.currentAccount.assets.find(x => x.code === namespace.Pepper.Resources.currentSponsor.code && x.issuer === namespace.Pepper.Resources.currentSponsor.issuer)
                                                };
                                                if (!asset.data) {
                                                    asset = {
                                                        "data": new namespace.Core.Asset(namespace.Pepper.Resources.currentSponsor.issuer, namespace.Pepper.Resources.currentSponsor.code, 0, () => {
                                                            domUpdateAssetPage();
                                                        }),
                                                        "hasAdd": true
                                                    };
                                                }
                                                view.selectedAsset = asset;
                                                domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                                domShowAssetPage(true);
                                            }
                                            else {
                                                if (namespace.Pepper.isDesktop) {
                                                    window.open(namespace.Pepper.Resources.currentSponsor.link, "_blank");
                                                }
                                                else {
                                                    window.location = namespace.Pepper.Resources.currentSponsor.link;
                                                }
                                            }
                                        }
                                    }
                                }

                                testElement(2, point, view.numPadSendBtn, isPointerDown, function () {
                                    view.amountError = false;
                                    view.addressError = false;
                                    switch (view.activityType) {
                                        case namespace.Pepper.ActivityType.SelectSendAmount:
                                            if (!Number.isNaN(Number(view.sendAmount)) && Number(view.sendAmount) > 0) {
                                                if (Number(namespace.Pepper.Tools.formatPrice(namespace.Core.currentAccount.getMaxSend(view.getActiveCarouselItem().asset.balance, view.getActiveCarouselItem().asset))) < view.sendAmount) {
                                                    view.amountErrorTime = 1;
                                                }
                                                else {
                                                    view.activityType = namespace.Pepper.ActivityType.SelectSendRecipient;
                                                    view.sendTransition = 0.3;
                                                    domShowAddressForm(true);
                                                    view.getActiveCarouselItem().transitionTime = 0.5;
                                                }
                                            }
                                            else {
                                                view.amountError = true;
                                                view.amountErrorTime = 1;
                                            }
                                            break;
                                        case namespace.Pepper.ActivityType.SelectSendRecipient:
                                            if ($("#address").val() !== "") {
                                                view.activityType = namespace.Pepper.ActivityType.ConfirmSend;
                                                view.sendTransition = 0.3;
                                                view.sendDestination = $("#address").val();
                                                view.sendMemo = $("#memo").val() !== "" ? $("#memo").val() : null;
                                                domShowAddressForm(false);

                                                if (view.getActiveCarouselItem().asset.issuer === "native") {
                                                    asset = StellarSdk.Asset.native();
                                                }
                                                else {
                                                    asset = new StellarSdk.Asset(
                                                        view.getActiveCarouselItem().asset.code,
                                                        view.getActiveCarouselItem().asset.issuer);
                                                }

                                                var stellarNet = new namespace.Core.StellarNetwork();
                                                stellarNet.sendPayment(
                                                    view.sendDestination,
                                                    asset,
                                                    view.sendAmount,
                                                    view.sendMemo,
                                                    (success, msg) => {
                                                        if (!success) {
                                                            if (view.isActivityMode) {
                                                                view.sendTransition = 0.3;
                                                                view.activityType = namespace.Pepper.ActivityType.DisplaySendSummary;
                                                                view.sendErrorTxt = msg;
                                                                console.error(JSON.stringify(msg));
                                                            }
                                                        }
                                                        else {
                                                            if (view.isActivityMode) {
                                                                view.sendTransition = 0.3;
                                                                view.activityType = namespace.Pepper.ActivityType.DisplaySendSummary;
                                                                view.sendErrorTxt = "";
                                                            }
                                                        }
                                                    });
                                            }
                                            else {
                                                view.addressError = true;
                                                view.addressErrorTime = 1;
                                                setTimeout(() => { $("#address").focus(); }, 10);
                                            }
                                            break;
                                        case namespace.Pepper.ActivityType.ConfirmSend:
                                            break;
                                        case namespace.Pepper.ActivityType.DisplaySendSummary:
                                            view.isActivityMode = false;
                                            view.sendFormEndTime = 0.5;
                                            view.list.startTime = 0.5;
                                            break;
                                    }
                                });

                                if (view.activityType === namespace.Pepper.ActivityType.SelectSendAmount) {
                                    for (let i = 0; i < view.numPad.length; i += 1) {
                                        item = view.numPad[i];
                                        testElement(2, point, item, isPointerDown, function () {
                                            view.amountError = false;
                                            if (item.id === 11) {
                                                if (view.sendAmount.length > 0) {
                                                    view.sendAmount = view.sendAmount.substring(0, view.sendAmount.length - 1);
                                                }
                                            }
                                            else if (item.id === 12 && view.sendAmount.length < view.maxSendDigit) {
                                                if (view.sendAmount.indexOf(".") === -1) {
                                                    if (view.sendAmount.length === 0) {
                                                        view.sendAmount += "0";
                                                    }
                                                    view.sendAmount += ".";
                                                }
                                            }
                                            else if (view.sendAmount.length < view.maxSendDigit) {
                                                if (view.sendAmount.length === 1 && view.sendAmount[0] === "0") {
                                                    view.sendAmount = "";
                                                }
                                                view.sendAmount += item.id;
                                            }
                                        });
                                    }
                                }
                                else if (view.activityType === namespace.Pepper.ActivityType.SelectSendRecipient) {
                                    testElement(2, point, view.bookBtn, isPointerDown, function () {
                                        $("#address-form").hide();
                                        view.loadScroller(namespace.Pepper.ScrollerType.Addresses);
                                    });

                                    window.onRetrieveClipboardData = function (data) {
                                        $("#address").val(data);
                                        $("#address").trigger("focus");
                                    };

                                    testElement(2, point, view.pasteBtn, isPointerDown, function () {
                                        if (window.Android) {
                                            window.Android.retrieveClipboardData();
                                        }
                                        else if (namespace.Pepper.isWebkitHost()) {
                                            webkit.messageHandlers.callbackHandler.postMessage({ "name": "retrieveClipboardData" });
                                        }
                                        else if (parent) {
                                            parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[160], "*");
                                        }
                                    });

                                    testElement(2, point, view.qrBtn, isPointerDown, function () {
                                        if (window.Android) {
                                            window.Android.scanQRCode();
                                        }
                                        else if (namespace.Pepper.isWebkitHost()) {
                                            webkit.messageHandlers.callbackHandler.postMessage({ "name": "scanQRCode" });
                                        }
                                        else if (parent) {
                                            parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[160], "*");
                                        }
                                    });
                                }
                                else if (!close && view.activityType === namespace.Pepper.ActivityType.Receive && view.getActiveCarouselItem()) {

                                    let clickedDeposit = false;
                                    testElement(2, point, view.depositBtn, isPointerDown, function () {
                                        clickedDeposit = true;
                                        view.loadScroller(namespace.Pepper.ScrollerType.CoinSwap);
                                    });

                                    if (!clickedDeposit && !view.scrollerEndTime && view.numPadCloseBtn.y + view.unit < point.y) {
                                        let key = view.getActiveCarouselItem().asset.deposit || namespace.Core.currentAccount.keys.publicKey();
                                        if (window.Android) {
                                            window.Android.copyToClipboard("address", key, namespace.Pepper.Resources.localeText[122]);
                                        }
                                        else if (namespace.Pepper.isWebkitHost()) {
                                            webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "address", "data": key, "message": namespace.Pepper.Resources.localeText[122] });
                                        }
                                        else {
                                            namespace.Pepper.copyToClipboard(key, namespace.Pepper.Resources.localeText[122]);
                                        }
                                        console.info(key);
                                    }
                                }
                                else if (view.activityType === namespace.Pepper.ActivityType.Trade) {

                                    testElement(2, point, view.confirmOrderBtn, isPointerDown, function () {
                                        if (namespace.Core.currentAccount.processingOrder && namespace.Core.currentAccount.processingOrder.result) {
                                            namespace.Core.currentAccount.processingOrder = null;
                                        }
                                        else if (namespace.Core.currentAccount.queuedOrder) {
                                            var stellarNet = new namespace.Core.StellarNetwork();

                                            // Promote to processing.
                                            namespace.Core.currentAccount.processingOrder = {
                                                "base": namespace.Core.currentAccount.queuedOrder.base,
                                                "quote": namespace.Core.currentAccount.queuedOrder.quote,
                                                "isBuy": namespace.Core.currentAccount.queuedOrder.isBuy,
                                                "price": namespace.Core.currentAccount.queuedOrder.price,
                                                "baseAmount": namespace.Core.currentAccount.queuedOrder.baseAmount,
                                                "quoteAmount": namespace.Core.currentAccount.queuedOrder.quoteAmount
                                            };
                                            namespace.Core.currentAccount.queuedOrder = null;
                                            view.orderTime = 0.3;

                                            // Send the offer.
                                            stellarNet.sendOffer((success, message) => {
                                                if (success) {
                                                    namespace.Core.currentAccount.processingOrder.result = { error: false };
                                                }
                                                else {
                                                    console.log(JSON.stringify(message));
                                                    namespace.Core.currentAccount.processingOrder.result = {
                                                        error: true,
                                                        status: message.response && message.response.data
                                                            && message.response.data.extras
                                                            && message.response.data.extras.result_codes
                                                            && message.response.data.extras.result_codes.operations
                                                            ? message.response.data.extras.result_codes.operations : message.response && message.response.data ? message.response.data.title : ""
                                                    };
                                                }
                                            });
                                        }
                                    });

                                    if (!namespace.Core.currentAccount.queuedOrder) {

                                        if (view.book.isDown && view.book.hasBar) {
                                            if (Math.abs(view.book.point.y - point.y) > view.book.rowHeight * 0.2) {
                                                view.book.offset += (view.book.point.y - point.y) * 0.6;
                                                view.book.downDistance += view.book.point.y - point.y;
                                                view.book.point = { "x": point.x, "y": point.y };
                                            }
                                        }
                                        view.book.isDown = false;
                                        view.book.scrollTime = 1.5;

                                        testBook(2, point, view.book, isPointerDown, function (item, index) {
                                            if (view.book.canClick) {
                                                if (item.data) {
                                                    let base = view.getActiveCarouselItem().asset;
                                                    if (base) {
                                                        let quote = view.quoteAssets[base.code + base.issuer];
                                                        if (quote) {
                                                            let propId = base.code + base.issuer + quote.code + quote.issuer;
                                                            let book = namespace.Pepper.orderBooks[propId];
                                                            if (item.overHistBtn) {
                                                                view.loadScroller(namespace.Pepper.ScrollerType.LastTrades);
                                                            }
                                                            else if (book && book.history && book.history.length && item.data.spot) {
                                                                updateTradeInputs(namespace.Pepper.Tools.formatPrice(
                                                                    namespace.Pepper.Tools.rationalPriceToDecimal(book.history[0].price)));
                                                            }
                                                            else if (!item.data.spot) {
                                                                if (point.x < item.x + view.unit * 3.3) {
                                                                    updateTradeInputs(namespace.Pepper.Tools.formatPrice(
                                                                        namespace.Pepper.Tools.rationalPriceToDecimal(item.data.price)));
                                                                }
                                                                else {
                                                                    updateTradeInputs(
                                                                        namespace.Pepper.Tools.formatPrice(
                                                                            namespace.Pepper.Tools.rationalPriceToDecimal(item.data.price)),
                                                                        namespace.Pepper.Tools.formatPrice(item.baseTotal));
                                                                }
                                                            }
                                                        }
                                                    }
                                                }

                                                if (item.overHistBtn) {
                                                    item.overHistBtn = false;
                                                }
                                            }
                                            else {
                                                item.overHistBtn = false;
                                            }
                                        });

                                        testElement(2, point, view.sellBtn, isPointerDown, function () {
                                            if (view.sellBtn.enabled) {
                                                prepareOrder(false);
                                            }
                                        });

                                        testElement(2, point, view.buyBtn, isPointerDown, function () {
                                            if (view.buyBtn.enabled) {
                                                prepareOrder(true);
                                            }
                                        });

                                        testElement(2, point, view.ordersBtn, isPointerDown, function () {
                                            if (namespace.Core.currentAccount.offers.length) {
                                                view.loadScroller(namespace.Pepper.ScrollerType.LiveOrders);
                                            }
                                        });
                                    }
                                    else {
                                        namespace.Core.currentAccount.queuedOrder = null;
                                    }
                                }
                                else if (view.activityType === namespace.Pepper.ActivityType.Exchange) {
                                    if (view.selectedGameShop) {
                                        if (view.shop.isDown && view.shop.hasBar) {
                                            if (Math.abs(view.shop.point.y - point.y) > view.shop.rowHeight * 0.2) {
                                                view.shop.offset += (view.shop.point.y - point.y) * 0.6;
                                                view.shop.downDistance += view.shop.point.y - point.y;
                                                view.shop.point = { "x": point.x, "y": point.y };
                                            }
                                        }
                                        view.shop.isDown = false;
                                        view.shop.scrollTime = 1.5;  

                                        testElement(2, point, view.shopMenuBtn, isPointerDown, function () {
                                            view.loadScroller(namespace.Pepper.ScrollerType.ShopMenu);
                                        });
                                        
                                        testShop(2, point, view.shop, isPointerDown, function (item, index) {
                                            if (view.shop.canClick) {                             
                                                if (!item.spot) {

                                                    const shopPriceRate = view.getActiveCarouselItem().shopPriceRate;
                                                    const collectiblePrices = view.getActiveCarouselItem().collectiblePrices;
                                                    let base = view.getActiveCarouselItem().asset;
                                                    let convertedPrice;
                                                    let collectiblePrice = collectiblePrices && collectiblePrices[item.data.code + item.data.issuer + item.data.id]
                                                                            ? Number(collectiblePrices[item.data.code + item.data.issuer + item.data.id]) : 0;
                                                    if(shopPriceRate && shopPriceRate.sourceAmount){
                                                        convertedPrice = Number(item.data.price) * Number(shopPriceRate.sourceAmount) / Number(shopPriceRate.amount);
                                                    }

                                                    if (item.overBuyBtn && convertedPrice) {
                                                        view.selectedBuyItem = item;
                                                        view.selectedBuyItem.ready = false;
                                                        view.selectedBuyItem.buying = false;
                                                        view.selectedBuyItem.success = false;
                                                        view.selectedBuyItem.error = null;
                                                        let hasEnough = convertedPrice <= namespace.Core.currentAccount.getMaxSend(base.balance, base) ? true : false;
                                                        if (hasEnough) {
                                                            let stellarNet = new namespace.Core.StellarNetwork();
                                                            stellarNet.findPaymentPaths(
                                                                view.selectedGameShop.data.shop.account,
                                                                view.selectedGameShop.data.shop.code,
                                                                view.selectedGameShop.data.shop.issuer,
                                                                namespace.Pepper.Tools.formatPrice(view.selectedBuyItem.data.price),
                                                                null,
                                                                (success, result) => {                                 
                                                                    if (success) {
                                                                        // Extract the best price from results.
                                                                        let sourceAmount;
                                                                        let bestPath;
                                                                        for (let v = 0; v < result.length; v += 1) {
                                                                            if (result[v].source_asset_type === "native" && base.issuer === "native" || 
                                                                                (base.code === result[v].source_asset_code && base.issuer === result[v].source_asset_issuer)) {
                                                                                if (!sourceAmount) {
                                                                                    sourceAmount = Number(result[v].source_amount);
                                                                                    bestPath = result[v].path.slice();
                                                                                }
                                                                                else {
                                                                                    if(Number(result[v].source_amount) < sourceAmount){
                                                                                        sourceAmount = Number(result[v].source_amount);
                                                                                        bestPath = result[v].path.slice();
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                        if (sourceAmount) {                                                                            
                                                                            view.selectedBuyItem.data.path = bestPath;
                                                                            view.selectedBuyItem.data.orderPrice = namespace.Pepper.Tools.formatPrice(sourceAmount);
                                                                            view.selectedBuyItem.ready = true;
                                                                        }
                                                                    }                            
                                                                });

                                                            view.loadScroller(namespace.Pepper.ScrollerType.ShopConfirm);
                                                        }
                                                    }
                                                    if (item.overBuyBtn && collectiblePrice) {
                                                        view.selectedBuyItem = item;
                                                        view.selectedBuyItem.ready = false;
                                                        view.selectedBuyItem.buying = false;
                                                        view.selectedBuyItem.success = false;
                                                        view.selectedBuyItem.error = null;
                                                        
                                                        let ownAsset = namespace.Core.currentAccount.assets.find(x => x.code === view.selectedBuyItem.data.code && x.issuer === view.selectedBuyItem.data.issuer);
                                                        let hasEnough = ownAsset && collectiblePrice <= namespace.Core.currentAccount.getMaxSend(base.balance, base) ? true : false;
                                                        if (hasEnough) {
                                                            let stellarNet = new namespace.Core.StellarNetwork();
                                                            stellarNet.findPaymentPaths(
                                                                namespace.Core.currentAccount.keys.publicKey(),
                                                                view.selectedBuyItem.data.code,
                                                                view.selectedBuyItem.data.issuer,
                                                                namespace.Pepper.Tools.formatPrice(view.selectedBuyItem.data.priceScale || 1),
                                                                null,
                                                                (success, result) => {                                 
                                                                    if (success) {
                                                                        // Extract the best price from results.
                                                                        let sourceAmount;
                                                                        let bestPath;
                                                                        for (let v = 0; v < result.length; v += 1) {
                                                                            if (result[v].source_asset_type === "native" && base.issuer === "native" || 
                                                                                (base.code === result[v].source_asset_code && base.issuer === result[v].source_asset_issuer)) {
                                                                                if (!sourceAmount) {
                                                                                    sourceAmount = Number(result[v].source_amount);
                                                                                    bestPath = result[v].path.slice();
                                                                                }
                                                                                else {
                                                                                    if(Number(result[v].source_amount) < sourceAmount){
                                                                                        sourceAmount = Number(result[v].source_amount);
                                                                                        bestPath = result[v].path.slice();
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                        if (sourceAmount) {                                                                            
                                                                            view.selectedBuyItem.data.path = bestPath;
                                                                            view.selectedBuyItem.data.orderPrice = namespace.Pepper.Tools.formatPrice(sourceAmount);
                                                                            view.selectedBuyItem.ready = true;
                                                                        }
                                                                    }                            
                                                                });

                                                            view.loadScroller(namespace.Pepper.ScrollerType.ShopConfirm);
                                                        }
                                                    }
                                                    else if (item.overMoreBtn) {
                                                        if(item.data.code) {
                                                            let ownAsset = namespace.Core.currentAccount.assets.find(x => x.code === item.data.code && x.issuer === item.data.issuer);
                                                            let nativeAsset = namespace.Core.currentAccount.assets.find(x => x.code === "XLM" && x.issuer === "native");
                                                            let canAdd = nativeAsset && namespace.Core.currentAccount.assets.length && namespace.Core.currentAccount.getMaxSend(nativeAsset.balance, nativeAsset) >= namespace.Core.currentAccount.getTrustBaseFee() ? true : false;
                                                            let asset = {
                                                                "data": ownAsset
                                                            };
                                                            if (!asset.data) {
                                                                asset = {
                                                                    "data": new namespace.Core.Asset(item.data.issuer, item.data.code, 0, () => {
                                                                        domUpdateAssetPage();
                                                                    }),
                                                                    "hasAdd": canAdd
                                                                };
                                                            }
                                                            view.selectedAsset = asset;
                                                            domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                                            domShowAssetPage(true);
                                                        }   
                                                        else {
                                                            if (namespace.Pepper.isDesktop) {
                                                                window.open(item.data.moreLink, "_blank");
                                                            }
                                                            else {
                                                                window.location = item.data.moreLink;
                                                            }
                                                        }
                                                    }
                                                }

                                                if (item.overBuyBtn) {
                                                    item.overBuyBtn = false;
                                                }
                                                if (item.overMoreBtn) {
                                                    item.overMoreBtn = false;
                                                }
                                            }
                                            else {
                                                item.overBuyBtn = false;
                                                item.overMoreBtn = false;
                                            }
                                        });
                                    }
                                    else {
                                        if (view.store.isDown && view.store.hasBar) {
                                            if (Math.abs(view.store.point.y - point.y) > view.store.rowHeight * 0.2) {
                                                view.store.offset += (view.store.point.y - point.y) * 0.6;
                                                view.store.downDistance += view.store.point.y - point.y;
                                                view.store.point = { "x": point.x, "y": point.y };
                                            }
                                        }
                                        view.store.isDown = false;
                                        view.store.scrollTime = 1.5;

                                        testElement(2, point, view.promoBtn, isPointerDown, function () {
                                            if (namespace.Pepper.storeData.length > 1 && namespace.Pepper.storeData[1].valid) {
                                                if (namespace.Pepper.storeData[1].data.action === "open_shop_activity") {
                                                    let itemData;
                                                    for (let v = 0; v < namespace.Pepper.storeData.length; v += 1) {
                                                        if (namespace.Pepper.storeData[v].data.gameid === namespace.Pepper.storeData[1].data.gameid
                                                            && namespace.Pepper.storeData[v].data.shop) {
                                                                itemData = namespace.Pepper.storeData[v];
                                                                break;
                                                            }
                                                    }
                                                    if (itemData) {
                                                        view.selectedGameShop = itemData;
                                                        view.shopTime = 0.3;
                                                        loadShop();
                                                    }
                                                }
                                                else if (namespace.Pepper.storeData[1].data.action === "open_link_activity") {
                                                    if (namespace.Pepper.isDesktop) {
                                                        window.open(namespace.Pepper.storeData[1].data.link, "_blank");
                                                    }
                                                    else {
                                                        window.location = namespace.Pepper.storeData[1].data.link;
                                                    }
                                                }                                                
                                                else {
                                                    loadGame(namespace.Pepper.storeData[1].data.gameid, namespace.Pepper.storeData[1].data.link, namespace.Pepper.storeData[1].data.gameid ? false : true, namespace.Pepper.storeData[1].data.external);
                                                }
                                            }
                                        });

                                        
                                        testElement(2, point, view.gamerIdBtn, isPointerDown, function () {
                                            if (!namespace.Core.currentAccount.friendlyAddress &&
                                                !namespace.Core.currentAccount.watchOnly) {

                                                view.closeSendPage(() => {
                                                    domShowAddressForm(false);
                                                    domShowTradeForm(false);
                                                });

                                                domShowGetFriendlyPage();
                                            }
                                            else if(namespace.Core.currentAccount.friendlyAddress) {
                                                if (window.Android) {
                                                    window.Android.copyToClipboard("address", namespace.Core.currentAccount.friendlyAddress, namespace.Pepper.Resources.localeText[122]);
                                                }
                                                else if (namespace.Pepper.isWebkitHost()) {
                                                    webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "address", "data": namespace.Core.currentAccount.friendlyAddress, "message": namespace.Pepper.Resources.localeText[122] });
                                                }
                                                else {
                                                    namespace.Pepper.copyToClipboard(namespace.Core.currentAccount.friendlyAddress, namespace.Pepper.Resources.localeText[122]);
                                                }
                                            }
                                        });

                                        testStore(2, point, view.store, isPointerDown, function (item, index) {
                                            if (view.store.canClick) {                                              
                                                if (!item.spot) {
                                                    let canCollapse = true;
                                                    if((index === 0 || index === 1) && (item.data.data.gameid || item.data.data.action)) {
                                                        if (item.data.data.action === "open_shop_activity") {
                                                            let itemData;
                                                            for (let v = 0; v < namespace.Pepper.storeData.length; v += 1) {
                                                                if (namespace.Pepper.storeData[v].data.gameid === item.data.data.gameid
                                                                    && namespace.Pepper.storeData[v].data.shop) {
                                                                        itemData = namespace.Pepper.storeData[v];
                                                                        break;
                                                                    }
                                                            }
                                                            if (itemData) {
                                                                view.selectedGameShop = itemData;
                                                                view.shopTime = 0.3;
                                                                loadShop();
                                                            }
                                                        }
                                                        else if (item.data.data.action === "open_link_activity") {
                                                            if (namespace.Pepper.isDesktop) {
                                                                window.open(item.data.data.link, "_blank");
                                                            }
                                                            else {
                                                                window.location = item.data.data.link;
                                                            }
                                                        }
                                                        else {
                                                            loadGame(item.data.data.gameid, item.data.data.link, false, item.data.data.external);
                                                        }
                                                    }
                                                    else if (item.overPlayBtn && item.data.data.gameid) {
                                                        canCollapse = false;
                                                        if (view.appId !== item.data.data.gameid) {
                                                            loadGame(item.data.data.gameid, item.data.data.link, false, item.data.data.external);
                                                        }
                                                        else {
                                                            domShowApp(false);
                                                        }
                                                    }
                                                    else if (item.overScoreBtn && item.data.data.gameid) {
                                                        view.selectedGame = item.data;
                                                        canCollapse = false;
                                                        if(view.selectedGame.data.leaderboard){
                                                            view.loadScroller(namespace.Pepper.ScrollerType.Leaderboard); 
                                                            if(namespace.leaderBoardRequestId){
                                                                clearTimeout(namespace.leaderBoardRequestId);
                                                            }
                                                            namespace.leaderBoardRequestId = setTimeout(() => { 
                                                                namespace.leaderBoardRequestId = null;
                                                                retrieveLeaderboard();                                                       
                                                            }, 1000);
                                                        }                                                    
                                                    }
                                                    else if (item.overShopBtn && item.data.data.gameid) {
                                                        canCollapse = false;
                                                        if(item.data.data.shop){
                                                            view.selectedGameShop = item.data;
                                                            view.shopTime = 0.3;
                                                            loadShop();
                                                        }                                                    
                                                    }

                                                    if (!item.lastSelected && index) {
                                                        item.lastSelectedTime = 0.3;
                                                        item.lastSelected = true;

                                                        for (let c = 2; c < view.store.items.length; c += 1) {
                                                            const otherItem = view.store.items[c];
                                                            if(item !== otherItem && otherItem.lastSelected){
                                                                otherItem.lastSelected = false;
                                                                otherItem.lastSelectedTime = otherItem.lastSelectedTime ? otherItem.lastSelectedTime : 0.3;
                                                            }
                                                        }
                                                    }
                                                    else if (canCollapse && index) {
                                                        item.lastSelected = false;
                                                        item.lastSelectedTime = item.lastSelectedTime ? item.lastSelectedTime : 0.3;
                                                    }
                                                }
                                                else {
                                                    if (item.overAppsBtn && view.exploreType !== namespace.Pepper.ExploreType.App) {
                                                        view.exploreType = namespace.Pepper.ExploreType.App;
                                                        loadStore(true);
                                                    }
                                                    else if (item.overGamesBtn && view.exploreType !== namespace.Pepper.ExploreType.Game) {
                                                        view.exploreType = namespace.Pepper.ExploreType.Game;
                                                        loadStore(true);
                                                    }
                                                }

                                                if (item.overAppsBtn) {
                                                    item.overAppsBtn = false;
                                                }
                                                if (item.overGamesBtn) {
                                                    item.overGamesBtn = false;
                                                }

                                                if (item.overPlayBtn) {
                                                    item.overPlayBtn = false;
                                                }
                                                if (item.overScoreBtn) {
                                                    item.overScoreBtn = false;
                                                }
                                                if (item.overShopBtn) {
                                                    item.overShopBtn = false;
                                                }
                                            }
                                            else {
                                                item.overPlayBtn = false;
                                                item.overScoreBtn = false;
                                                item.overShopBtn = false;
                                            }
                                        });
                                    }
                                }
                            }
                            else {

                                if (view.list.isDown && view.list.hasBar) {
                                    if (Math.abs(view.list.point.y - point.y) > view.list.rowHeight * 0.2) {
                                        view.list.offset += (view.list.point.y - point.y) * 0.6;
                                        view.list.downDistance += view.list.point.y - point.y;
                                        view.list.point = { "x": point.x, "y": point.y };
                                    }
                                }
                                view.list.isDown = false;
                                view.list.scrollTime = 1.5;

                                testList(2, point, view.list, isPointerDown, function (item, index) {
                                    if (view.list.canClick) {
                                        switch (view.list.type) {
                                            case namespace.Pepper.ListType.Transactions:
                                                if (item.data.type !== "asset" && item.overLaunchBtn) {
                                                    item.overLaunchBtn = false;

                                                    let endpoint = namespace.Pepper.Tools.removeTrailingSlash(namespace.config.opsEndPoint);
                                                    console.log(endpoint);
                                                    if (namespace.Pepper.isDesktop) {
                                                        window.open(endpoint + item.data.id, "_blank");
                                                    }
                                                    else {
                                                        window.location = endpoint + item.data.id;
                                                    }
                                                }
                                                else if (item.data.memo && item.overMemoBtn) {
                                                    item.overMemoBtn = false;
                                                    if (window.Android) {
                                                        window.Android.copyToClipboard("memo", item.data.memo, namespace.Pepper.Resources.localeText[123] + item.data.memo);
                                                    }
                                                    else if (namespace.Pepper.isWebkitHost()) {
                                                        webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "memo", "data": item.data.memo.toString(), "message": namespace.Pepper.Resources.localeText[123] + item.data.memo.toString() });
                                                    }
                                                    else {
                                                        namespace.Pepper.copyToClipboard(item.data.memo, namespace.Pepper.Resources.localeText[123] + item.data.memo);
                                                    }
                                                }
                                                else if (item.overCopyBtn) {
                                                    item.overCopyBtn = false;
                                                    switch (item.data.type) {
                                                        case "payment":
                                                            if (window.Android) {
                                                                if (item.data.to === namespace.Core.currentAccount.keys.publicKey()) {
                                                                    window.Android.copyToClipboard("address", item.data.from, namespace.Pepper.Resources.localeText[122]);
                                                                }
                                                                else {
                                                                    window.Android.copyToClipboard("address", item.data.to, namespace.Pepper.Resources.localeText[122]);
                                                                }
                                                            }
                                                            else if (namespace.Pepper.isWebkitHost()) {
                                                                if (item.data.to === namespace.Core.currentAccount.keys.publicKey()) {
                                                                    webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "address", "data": item.data.from, "message": namespace.Pepper.Resources.localeText[122] });
                                                                }
                                                                else {
                                                                    webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "address", "data": item.data.to, "message": namespace.Pepper.Resources.localeText[122] });
                                                                }
                                                            }
                                                            else {
                                                                if (item.data.to === namespace.Core.currentAccount.keys.publicKey()) {
                                                                    namespace.Pepper.copyToClipboard(item.data.from, namespace.Pepper.Resources.localeText[122]);
                                                                }
                                                                else {
                                                                    namespace.Pepper.copyToClipboard(item.data.to, namespace.Pepper.Resources.localeText[122]);
                                                                }
                                                            }
                                                            break;
                                                        case "create_account":
                                                            if (window.Android) {
                                                                window.Android.copyToClipboard("address", item.data.source_account, namespace.Pepper.Resources.localeText[122]);
                                                            }
                                                            else if (namespace.Pepper.isWebkitHost()) {
                                                                webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "address", "data": item.data.source_account, "message": namespace.Pepper.Resources.localeText[122] });
                                                            }
                                                            else {
                                                                namespace.Pepper.copyToClipboard(item.data.source_account, namespace.Pepper.Resources.localeText[122]);
                                                            }
                                                            break;
                                                        case "change_trust":
                                                        case "allow_trust":
                                                            if (window.Android) {
                                                                window.Android.copyToClipboard("address", item.data.asset_issuer, namespace.Pepper.Resources.localeText[122]);
                                                            }
                                                            else if (namespace.Pepper.isWebkitHost()) {
                                                                webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "address", "data": item.data.asset_issuer, "message": namespace.Pepper.Resources.localeText[122] });
                                                            }
                                                            else {
                                                                namespace.Pepper.copyToClipboard(item.data.asset_issuer, namespace.Pepper.Resources.localeText[122]);
                                                            }
                                                            break;
                                                    }
                                                }
                                                break;
                                            case namespace.Pepper.ListType.Assets:
                                                if (!item.data.balance && item.overAddBtn && !namespace.Pepper.queryAsset && item.hasAdd) {
                                                    item.overAddBtn = false;
                                                    namespace.Pepper.queryAsset = item.data;
                                                    let stellarNet = new namespace.Core.StellarNetwork();
                                                    stellarNet.setTrust(
                                                        new StellarSdk.Asset(
                                                            item.data.code,
                                                            item.data.issuer),
                                                        (success, msg) => {
                                                            if (!success) {
                                                                namespace.Pepper.queryAsset = null;
                                                                console.log(msg);
                                                            }
                                                        });
                                                }
                                                else {
                                                    view.selectedAsset = item;
                                                    domShowModalPage(true, namespace.Pepper.WizardType.ViewAsset);
                                                    domShowAssetPage(true);
                                                }
                                                break;
                                        }
                                    }
                                });
                            }
                        }
                    }

                    view.carousel.isDown = false;
                    view.carousel.scrollTime = 1.5;
                    view.carousel.clicked = false;
                }
            }
        }

        view.discardedPanel = false;

        isPointerDown = false;
    }

    function updateTradeInputs(inputPrice, inputBaseAmount, inputQuoteAmount) {
        let updated = false;
        if (view && view.getActiveCarouselItem()) {
            const base = view.getActiveCarouselItem().asset;
            const quote = view.quoteAssets[base.code + base.issuer];
            if (base && quote && (base.code !== quote.code || base.issuer !== quote.issuer)) {
                const book = namespace.Pepper.orderBooks[base.code + base.issuer + quote.code + quote.issuer];
                if (book) {
                    let updatedPrice, updatedBase, updatedQuote;
                    if (inputPrice) {
                        updatedPrice = true;
                        $("#trade-price").val(inputPrice);
                    }
                    if (inputBaseAmount) {
                        updatedBase = true;
                        $("#base-amount").val(inputBaseAmount);
                    }
                    if (inputQuoteAmount) {
                        updatedQuote = true;
                        $("#quote-amount").val(inputQuoteAmount);
                    }

                    let price = Number($("#trade-price").val());
                    let baseAmount = Number($("#base-amount").val());
                    let quoteAmount = Number($("#quote-amount").val());

                    if ((updatedPrice || updatedBase) && price > 0 && baseAmount > 0) {
                        quoteAmount = price * baseAmount;
                        $("#quote-amount").val(namespace.Pepper.Tools.formatPrice(quoteAmount));
                    }
                    else if ((updatedQuote || updatedBase) && !price && quoteAmount > 0 && baseAmount > 0) {
                        price = quoteAmount / baseAmount;
                        $("#trade-price").val(namespace.Pepper.Tools.formatPrice(price));
                    }
                    else if ((updatedPrice || updatedQuote) && quoteAmount > 0 && price > 0) {
                        baseAmount = quoteAmount / price;
                        $("#base-amount").val(namespace.Pepper.Tools.formatPrice(baseAmount));
                    }

                    if (price === 0 || baseAmount === 0 || quoteAmount === 0) {
                        view.sellBtn.enabled = false;
                        view.buyBtn.enabled = false;
                    }
                    else {
                        if (Number(namespace.Pepper.Tools.formatPrice(baseAmount)) >
                            Number(namespace.Pepper.Tools.formatPrice(namespace.Core.currentAccount.getMaxSend(base.balance, base)))) {
                            view.sellBtn.enabled = false;
                        }
                        else {
                            view.sellBtn.enabled = true;
                        }

                        if (Number(namespace.Pepper.Tools.formatPrice(quoteAmount)) >
                            Number(namespace.Pepper.Tools.formatPrice(namespace.Core.currentAccount.getMaxSend(quote.balance, quote)))) {
                            view.buyBtn.enabled = false;
                        }
                        else {
                            view.buyBtn.enabled = true;
                        }
                    }
                    updated = true;
                }
            }
        }

        if (!updated && view) {
            view.buyBtn.enabled = false;
            view.sellBtn.enabled = false;

            $("#trade-price").val("");
            $("#quote-amount").val("");
            $("#base-amount").val("");
        }

        namespace.Core.currentAccount.queuedOrder = null;
    }

    function loadGame(id, url, noloader, external) {
        if(id && id !== "") {
            generateToken(id, (token) => {
                if (token) {
                    if(url[url.length - 1] !== "/"){
                        url += "/";
                    }
                    url += "?token=" + token;
                    domShowApp(true, id, url, noloader, external);
                }
            });
        }
    }

    function retrieveLeaderboard(userTriggered) {
        if(view && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Exchange 
            && view.showScroller
            && view.scroller.type === namespace.Pepper.ScrollerType.Leaderboard
            && view.selectedGame && view.selectedGame.data && view.selectedGame.data.leaderboard
            && !view.isLoadingLeaderboard) {
            view.isLoadingLeaderboard = true;
            let playerName = "";
            if(namespace.Core.currentAccount.friendlyAddress){
                playerName = namespace.Core.currentAccount.friendlyAddress.replace("*litemint.com", "");
            }
            if (userTriggered) {
                view.scroller.items = [];
            }

            $.get(view.selectedGame.data.leaderboard,
            {
                "playername": playerName
            })
            .done(function (response) {
                view.isLoadingLeaderboard = false;
                if (response) {
                    view.scroller.items = [];
                    if (view.showAllTime && response.ath && response.countall) {

                        if (view.selectedGame.data.challenge) {
                            for(let i= 0; i < Math.min(3, response.top.length); i += 1){
                                view.scroller.items.push({
                                    "id": view.scroller.items.length,
                                    "data": response.top[i],
                                    "count": response.countall
                                });
                            }

                            while (view.scroller.items.length < 4) {
                                view.scroller.items.push({
                                    "id": view.scroller.items.length,
                                    "data": {
                                        "name": namespace.Pepper.Resources.localeText[226],
                                        "score":""},
                                    "count": response.countall
                                });
                            }
                        }

                        for(let i= 0; i <response.ath.length; i += 1){
                            view.scroller.items.push({
                                "id": view.scroller.items.length,
                                "data": response.ath[i],
                                "count": response.countall
                            });
                        }
                    }
                    else {
                        for(let i= 0; i <response.top.length; i += 1){
                            view.scroller.items.push({
                                "id": i,
                                "data": response.top[i],
                                "count": response.count
                            });
                        }      
                    }
                    view.needRedraw = true;
                }
            })
            .fail(function (xhr, status, error) {
                view.isLoadingLeaderboard = false;
            });
        }
    }

    function prepareOrder(isBuy) {
        const base = view.getActiveCarouselItem().asset;
        const quote = view.quoteAssets[base.code + base.issuer];
        if (base && quote) {
            namespace.Core.currentAccount.queuedOrder = {
                "base": (base.issuer === "native") ? StellarSdk.Asset.native() : new StellarSdk.Asset(base.code, base.issuer),
                "quote": (quote.issuer === "native") ? StellarSdk.Asset.native() : new StellarSdk.Asset(quote.code, quote.issuer),
                "isBuy": isBuy,
                "price": namespace.Pepper.Tools.formatPrice($("#trade-price").val()),
                "baseAmount": namespace.Pepper.Tools.formatPrice($("#base-amount").val()),
                "quoteAmount": namespace.Pepper.Tools.formatPrice($("#quote-amount").val())
            };
            view.orderTime = 0.3;
        }
    }

    function reloadAccountOperations(indexes) {
        let applyFilter = function (item) {
            let passed = false;
            if (view.account.filters[namespace.Pepper.FilterType.Trust] &&
                    (item.type === "change_trust" || item.type === "allow_trust")
                || view.account.filters[namespace.Pepper.FilterType.PaymentReceived] &&
                    (item.type === "payment" && item.to === namespace.Core.currentAccount.keys.publicKey())
                || view.account.filters[namespace.Pepper.FilterType.PaymentReceived] &&
                    (item.type === "create_account")
                || view.account.filters[namespace.Pepper.FilterType.PaymentSent] &&
                    (item.type === "payment" && item.to !== namespace.Core.currentAccount.keys.publicKey())
                || view.account.filters[namespace.Pepper.FilterType.Trades] &&
                    (item.type === "create_passive_offer"
                    || item.type === "create_passive_sell_offer"
                    || item.type === "manage_offer"
                    || item.type === "manage_sell_offer"
                    || item.type === "manage_buy_offer"
                    || item.type === "path_payment"
                    || item.type === "path_payment_strict_receive")
                || view.account.filters[namespace.Pepper.FilterType.Other] &&
                    (item.type === "set_options"
                    || item.type === "bump_sequence"
                    || item.type === "manage_data"
                    || item.type === "inflation"
                    || item.type === "account_merge")) {
                passed = true;
            }
            return passed;
        };

        view.list.items = [];
        for (let i = 0; i < namespace.Core.currentAccount.operations.length; i += 1) {
            const item = namespace.Core.currentAccount.operations[i];
            const insertTime = indexes && indexes.indexOf(i) !== -1 ? 2 : 0;
            const asset = namespace.Core.currentAccount.assets.find(x => x.code === item.asset_code && x.issuer === item.asset_issuer);
            if (applyFilter(item)) {
                view.list.items.push({
                    "asset": asset,
                    "data": item,
                    "date": new Date(item.created_at).toLocaleString(),
                    "rawDate": new Date(item.created_at).getTime(),
                    "insertTime": insertTime,
                    "copyButtonTime": 0,
                    "launchButtonTime": 0,
                    "memoButtonTime": 0
                });
            }
        }
    }

    function reloadAssets() {
        function compare(a, b) {
            const ca1 = a.data.balance ? 0 : 1;
            const ca2 = b.data.balance ? 0 : 1;
            const cb1 = Number(a.data.balance) ? 0 : 1;
            const cb2 = Number(b.data.balance) ? 0 : 1;
            const cc1 = a.data.name;
            const cc2 = b.data.name;
            if (ca1 < ca2) return -1;
            if (ca1 > ca2) return 1;
            if (cb1 < cb2) return -1;
            if (cb1 > cb2) return 1;
            if (cc1 < cc2) return -1;
            if (cc1 > cc2) return 1;
            return 0;
        }

        view.list.items = [];

        if (view.error === namespace.Pepper.ViewErrorType.AccountNotAvailable) {
            return;
        }

        // At least one true criteria to pass.
        let applyFilter = function (item, trusted) {
            let passed = true;
            if (view.account.filters[namespace.Pepper.FilterType.WithBalance]
                && Number(item.balance) === 0) {
                passed = false;
            }
            if (passed && view.account.filters[namespace.Pepper.FilterType.Trusted]
                && !trusted) {
                passed = false;
            }
            // This filter seems to be source of confusion as items
            // can be BOTH trusted and unverified. Ignoring for now.
            //if (passed && view.account.filters[namespace.Pepper.FilterType.Verified]
            //    && !item.verified) {
               // passed = false;
            //}
            return passed;
        };

        for (let i = 0; i < namespace.Core.currentAccount.assets.length; i += 1) {
            const item = namespace.Core.currentAccount.assets[i];
            if (applyFilter(item, true)) {
                view.list.items.push({
                    "data": item,
                    "hasAdd": false
                });
            }

            if (view.selectedAsset && view.selectedAsset.data
                && view.selectedAsset.data.code === item.code
                && view.selectedAsset.data.issuer === item.issuer) {
                view.selectedAsset.data = item;
            }
        }

        if (namespace.Core.currentAccount.assets.length === 0) {
            if (applyFilter(view.placeHolderAsset.asset, true)) {
                view.list.items.push({
                    "data": view.placeHolderAsset.asset,
                    "hasAdd": false
                });
            }
        }

        let nativeAsset = namespace.Core.currentAccount.assets.find(x => x.code === "XLM" && x.issuer === "native");
        for (let i = 0; i < namespace.config.defaultAssets.length; i += 1) {
            const item = namespace.config.defaultAssets[i];
            if (!namespace.Core.currentAccount.assets.find(x => x.code === item.code && x.issuer === item.issuer)) {
                if (applyFilter(item.asset, false)) {
                    let canAdd = nativeAsset && namespace.Core.currentAccount.assets.length
                        && namespace.Core.currentAccount.getMaxSend(nativeAsset.balance, nativeAsset) >= namespace.Core.currentAccount.getTrustBaseFee()
                        ? true : false;
                    view.list.items.push({
                        "data": item.asset,
                        "hasAdd": canAdd
                    });
                }
            }
        }

        if (view.showScroller && view.scroller.type === namespace.Pepper.ScrollerType.AddAsset) {
            for (let i = 0; i < view.scroller.items.length; i += 1) {
                let asset = namespace.Core.currentAccount.assets.find(x => x.code === view.scroller.items[i].data.code && x.issuer === view.scroller.items[i].data.issuer);
                if (asset) {
                    view.scroller.items[i].data = asset;
                }
                else {
                    view.scroller.items[i].data.balance = 0;
                }

                let canAdd = nativeAsset && namespace.Core.currentAccount.assets.length
                    && namespace.Core.currentAccount.getMaxSend(nativeAsset.balance, nativeAsset) >= namespace.Core.currentAccount.getTrustBaseFee()
                    ? true : false;
                view.scroller.items[i].hasAdd = canAdd;
            }
        }

        view.list.items.sort(compare);
    }

    function signIn(cb) {
        const loadCarousel = function () {
            let mainAsset;
            view.placeHolderAsset = null;
            for (let i = 0; i < namespace.Core.currentAccount.assets.length; i += 1) {
                const asset = namespace.Core.currentAccount.assets[i];
                if (asset.issuer === "native") {
                    mainAsset = asset;
                }
                else {
                    view.carousel.items.push({ "asset": asset });
                }
            }
            view.carousel.items.sort((a, b) => {
                return a.asset.code < b.asset.code ? -1 : a.asset.code > b.asset.code ? 1 : 0;
            });
            view.carousel.items.unshift({ "asset": mainAsset });
        };

        let firstUpdate = true;
        namespace.Pepper.queryAsset = null;
        const data = namespace.Pepper.loadWalletData();
        const stellarNet = new namespace.Core.StellarNetwork();

        view.account = data.accounts[data.lastaccount];
        view.quoteAssets = {};

        view.resetCarousel();
        view.page = namespace.Pepper.PageType.Dashboard;
        view.exploreType = namespace.Pepper.ExploreType.Game;

        view.resetBook();

        namespace.Pepper.orderBooks = { "skipCount": 0, "oldBook": "" };

        stellarNet.loadDefaultAssets();
        stellarNet.attachAccount((full, indexes, orders) => {
            stellarNet.updateAccount(full && !firstUpdate).then((account) => {
                if (!full || firstUpdate) {
                    firstUpdate = false;
                    view.needRedraw = true;
                }
                else {
                    view.resetCarousel();
                    loadCarousel();
                    namespace.Pepper.queryAsset = null;
                    view.needRedraw = true;
                }

                if (view.tabId === 0) {
                    reloadAccountOperations(indexes);
                }
                else if (view.tabId === 1) {
                    reloadAssets();
                }

                if (orders) {
                    view.cancellingOffer = 0;
                    if (view.showScroller && view.scroller.type === namespace.Pepper.ScrollerType.LiveOrders) {
                        view.scroller.items = [];
                        for (let i = 0; i < namespace.Core.currentAccount.offers.length; i += 1) {
                            view.scroller.items.push({
                                "id": i,
                                "data": namespace.Core.currentAccount.offers[i],
                                "delete": view.cancellingOffer === namespace.Core.currentAccount.offers[i].id ? true : false,
                                "slideTime": view.cancellingOffer === namespace.Core.currentAccount.offers[i].id ? 0.3 : 0
                            });
                        }

                        if (!namespace.Core.currentAccount.offers.length) {
                            view.scrollerEndTime = 0.3;
                        }
                    }
                }

                if (view.selectedGameShop && 
                    view.selectedGameShop.data && 
                    view.selectedGameShop.data.shop) { 
                    loadShop();
                }
            });
        }).then(function () {
            view.error = namespace.Pepper.ViewErrorType.None;
            view.closeSendPage(() => {
                domShowAddressForm(false);
                domShowTradeForm(false);
            });
            view.resetList(namespace.Pepper.ListType.Transactions);
            loadCarousel();
            if (cb) {
                cb();

                if(namespace.Pepper.onSignIn){
                    namespace.Pepper.onSignIn();
                }

                if (gtag) {
                    gtag("event", "click", { "event_category": "app", "event_label": "signin" });
                }
            }
        }).catch(function (err) {           
            if (cb) {
                cb(err);
            }
        });
    }

    function showMarketplace() {

        loadStore();

        if (!namespace.Core.currentAccount.friendlyAddress) {
            namespace.Core.Account.ResolveAccount(namespace.Core.currentAccount.keys.publicKey(), "litemint.com", (addr) => {
                namespace.Core.currentAccount.friendlyAddress = addr;
                view.needRedraw = true;
            });
        }

        view.activityType = namespace.Pepper.ActivityType.Exchange;
        view.isActivityMode = true;
        view.sendFormTime = 0.5;

        for (let i = 0; i < view.carousel.items.length; i += 1) {
            if (view.carousel.items[i].chartMode) {
                view.carousel.items[i].chartMode = false;
                view.carousel.items[i].transitionTime = 0.5;
            }
        }

        if (view.placeHolderAsset) {
            view.placeHolderAsset.chartMode = false;
            view.placeHolderAsset.transitionTime = 0.5;
        }
    }

    function handleSignInError(error) {
        if (error) {
            // Create a placeHolder asset.
            if (!view.placeHolderAsset) {
                view.placeHolderAsset = { "asset": new namespace.Core.Asset("native", "XLM", "0") };
            }

            if (namespace.Core.currentAccount.keys) {
                if (error.response && error.response.status === 404) {
                    view.error = namespace.Pepper.ViewErrorType.AccountNotCreated;

                    if(namespace.Pepper.onSignIn){
                        namespace.Pepper.onSignIn();
                    }

                    if (gtag) {
                        gtag("event", "click", { "event_category": "app", "event_label": "signin" });
                    }

                    // Install a watch on the account to get notified of creation.
                    const stellarNet = new namespace.Core.StellarNetwork();
                    stellarNet.watchAccount(namespace.Core.currentAccount.keys.publicKey(),
                        () => {
                            signIn((error) => {
                                handleSignInError(error);
                            });
                        }
                    );
                }
                else {
                    view.error = namespace.Pepper.ViewErrorType.AccountNotAvailable;
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

    function signOutCb(signUp) {
        if (retryId) {
            clearTimeout(retryId);
        }

        if (view) {
            view.resetList(namespace.Pepper.ListType.Transactions);
            view.resetPinPage(signUp);
        }

        new namespace.Core.StellarNetwork().detachAccount();

        domShowApp(false);

        if(namespace.Pepper.onSignOut){
            namespace.Pepper.onSignOut();
        }
    }

    function generateToken (purpose, cb) {
        const getAuthKey = function (cb) {
            // Get the authentication public key (ECDH).
            $.ajax(namespace.config.apiUrl + "/.auth/getkey").then(
                function success(response) {         
                    cb(response);
                },
                function fail(data, status) {
                    cb();
                }
            );
        };

        const getToken = function (pair, signed, cb) {
            $.post(namespace.config.apiUrl + "/.auth/gettoken", {
                purpose: purpose,
                address: namespace.Core.currentAccount.keys.publicKey(),
                data: signed,
                ecdh: pair.getPublic(true, "hex")
            }).then(
                function success(response) {
                    if (response && !response.error) {
                        cb(response.token);
                    }
                    else{
                        cb();
                    }
                },
                function fail(data, status) {
                    cb();
                }
            );
        };

        getAuthKey((key) => {
            if (key) {
                // Create the authentication key.
                const ecdh = new elliptic.ec("curve25519");
                const authKey = ecdh.keyFromPublic(namespace.Core.Utils.hexToBytes(key));

                // Generate a new ECDH key pair.
                const pair = ecdh.genKeyPair();

                // Derive the shared secret and sign it with the Stellar Key.
                const sharedSecret = pair.derive(authKey.getPublic());
                const nothingUpMySleeve = namespace.Core.Utils.hexToBytes(sharedSecret.toString(16));
                getToken(pair, 
                    namespace.Core.Utils.bytesToHex(namespace.Core.currentAccount.keys.sign(nothingUpMySleeve)), 
                    (token) => {
                        cb(token);
                });
            }
            else {
                cb();
            }
        });
    };

    function domUpdate() {
        if (view && view.needDomUpdate) {
            view.needDomUpdate = false;

            $("textarea, input, button").not(".spear").css("fontSize", view.baseFontSize * 0.8 / pixelRatio + "px");
            $("#asset-page").css("fontSize", view.baseFontSize * 0.8 / pixelRatio + "px");
            $("textarea, input, button").not(".spear").css("padding",
                view.baseFontSize * 0.5 / pixelRatio + "px "
                + view.baseFontSize * 0.5 / pixelRatio + "px "
                + view.baseFontSize * 0.5 / pixelRatio + "px "
                + view.baseFontSize * 0.25 / pixelRatio + "px");
            $(".group").css("margin", view.baseFontSize * 0.8 / pixelRatio + "px 0");

            if (view.showModalPage) {
                $("#verification-form").css({ top: (view.viewport.y + view.unit * 5.3) / pixelRatio, left: (view.viewport.x + view.unit * 0.5) / pixelRatio });
                $("#verification-form").width((view.viewport.width - view.unit) / pixelRatio);
                $("#verification-form").height(view.unit * 1.3 / pixelRatio);

                $("#import-form").css({ top: (view.viewport.y + view.unit * 3.5) / pixelRatio, left: (view.viewport.x + view.unit * 0.5) / pixelRatio });
                $("#import-form").width((view.viewport.width - view.unit) / pixelRatio);
                $("#import-form").height(view.unit * 1.3 / pixelRatio);
                $("#import").css("fontSize", view.baseFontSize * 0.6 / pixelRatio + "px");
            }

            if (view.isActivityMode) {
                switch (view.activityType) {
                    case namespace.Pepper.ActivityType.SelectSendAmount:
                    case namespace.Pepper.ActivityType.SelectSendRecipient:
                    case namespace.Pepper.ActivityType.ConfirmSend:
                    case namespace.Pepper.ActivityType.DisplaySendSummary:
                        $("#address-form").css({ top: (view.viewport.y + view.unit * 5.5) / pixelRatio, left: (view.viewport.x + view.unit * 0.5) / pixelRatio });
                        $("#address-form").width((view.viewport.width - view.unit) / pixelRatio);
                        $("#address-form").height(view.unit * 2.5 / pixelRatio);
                        break;
                    case namespace.Pepper.ActivityType.Trade:
                        $("#trade-price-form").css({ top: (view.book.y - view.book.headerHeight + view.unit * 1.14) / pixelRatio, left: (view.book.x + view.unit * 0.14) / pixelRatio });
                        $("#base-amount-form").css({ top: (view.book.y - view.book.headerHeight + view.unit * 1.14) / pixelRatio, left: (view.book.x + view.unit * 3.4) / pixelRatio });
                        $("#quote-amount-form").css({ top: (view.book.y - view.book.headerHeight + view.unit * 1.14) / pixelRatio, left: (view.book.x + view.unit * 6.65) / pixelRatio });

                        $("#trade-price-form, #base-amount-form, #quote-amount-form").width((view.unit * 3.2) / pixelRatio);
                        $("#trade-price-form, #base-amount-form, #quote-amount-form").height(view.unit * 1.2 / pixelRatio);

                        $(".trade-input").not(".spear").css("fontSize", view.baseFontSize * 0.67 / pixelRatio + "px");
                        $(".trade-input").not(".spear").css("padding", view.unit * 0.2 / pixelRatio + "px");
                        $(".trade-input").not(".spear").css("border", view.unit * 0.02 / pixelRatio + "px solid rgb(42, 193, 188)");
                        $(".trade-input").not(".spear").css("-webkit-border-radius", view.unit * 0.18 / pixelRatio + "px");
                        $(".trade-input").not(".spear").css("-moz-border-radius", view.unit * 0.18 / pixelRatio + "px");
                        $(".trade-input").not(".spear").css("border-radius", view.unit * 0.18 / pixelRatio + "px");
                        break;
                }
            }

            if (view.showScroller &&
                view.scroller.type === namespace.Pepper.ScrollerType.AddAsset) {
                $("#domain-form").css({ top: (view.viewport.y - view.unit * 0.17) / pixelRatio, left: (view.viewport.x + view.unit * 1.2) / pixelRatio });
                $("#domain-form").width((view.viewport.width - view.unit * 2.4) / pixelRatio);
                $("#domain-form").height(view.unit * 1.8 / pixelRatio);
            }

            if (view.showScroller &&
                view.scroller.type === namespace.Pepper.ScrollerType.AccountSettings) {
                $("#rename-form").css({ top: (view.scroller.y - view.unit * 1.6) / pixelRatio, left: (view.scroller.x + view.unit * 0.5) / pixelRatio });
                $("#rename-form").width((view.scroller.width - view.unit * 1) / pixelRatio);
                $("#rename-form").height(view.unit * 1.8 / pixelRatio);
            }

            if (view.showModalPage &&
                view.modalStep === namespace.Pepper.WizardType.ViewAsset) {
                $("#asset-page").css({ top: (view.viewport.y + view.unit * 3.4) / pixelRatio, left: (view.viewport.x + view.unit * 0.5) / pixelRatio });
                $("#asset-page").width((view.viewport.width - view.unit * 1) / pixelRatio);
                //$("#asset-page").height(view.unit * 3.8 / pixelRatio);
            }

            if (view.showAbout) {
                $("#about-title").css("fontSize", view.baseFontSize * 0.75 / pixelRatio + "px");
                $("#about-page, .simple-button").css("fontSize", view.baseFontSize * 0.7 / pixelRatio + "px");
                $("#about-page").css({ top: (view.viewport.y + view.viewport.height * 0.2) / pixelRatio, left: view.viewport.x / pixelRatio });
                $("#about-page").width(view.viewport.width / pixelRatio);
                $("#about-page").height(view.viewport.height * 0.8 / pixelRatio);
            }
            else {
                $("#about-page").css({ top: view.viewport.y / pixelRatio + view.viewport.height / pixelRatio + view.unit, left: view.viewport.x / pixelRatio });
                $("#about-page").width(view.viewport.width / pixelRatio);
                $("#about-page").height();
                if ($("#about-page").css("display") !== "none") {
                    setTimeout(() => {
                        $("#about-page").hide();
                    }, 500);
                }
            }
            view.needRedraw = true;
        }
    }

    function domShowApp(show, id, url, noloader, external) {
        if (show) {
            if (external && !namespace.Pepper.isDesktop) {
                if (namespace.Pepper.isDesktop) {
                    window.open(url, "_blank");
                }
                else {
                    window.location = url;
                }
            }
            else {
                if (view) {
                    view.appId = id;
                    view.needRedraw = true;
                }
                if(!noloader){
                    $("#activity-loader").show();
                }
                if(!namespace.Pepper.isDesktop) {
                    $("#handleBtn").fadeIn();
                    $("#activity-view").css("top", namespace.Pepper.barHeight / pixelRatio + "px");
                    $("#activity-view").css("height", ($(document).height() - namespace.Pepper.barHeight / pixelRatio)  + "px");
                    $("#activity-view").animate({
                        width: "100%"
                    }, 350, "swing", function () {
                        $("#activity-frame").attr("src",url);

                        if ((namespace.Pepper.isWebkitHost() && !webkit.messageHandlers.supportStorePolicy)
                            || (namespace.Pepper.isWebkitHost() && !url.includes("litemint.store"))) {
                            $("#activity-view").css("width", "0%");
                            $("#handleBtn").hide();
                        }
                    });

                    if (window.Android && window.Android.unlockOrientation) {
                        window.Android.unlockOrientation();
                    }
                    else if (namespace.Pepper.isWebkitHost()) {
                        webkit.messageHandlers.callbackHandler.postMessage({ "name": "unlockOrientation" });
                    }
                }
                else {
                    $("#activity-frame").attr("src",url);
                }
            }
        }
        else {
            if (view) {
                view.appId = null;
                view.needRedraw = true;
            }
            if(!namespace.Pepper.isDesktop) {
                let dest = ""
                if (namespace.Pepper.isWebkitHost() && webkit.messageHandlers.supportStorePolicy
                    || !namespace.Pepper.isWebkitHost()) {
                        dest = "https://litemint.store/blank.html";
                }
                $("#handleBtn").fadeOut();
                $("#activity-frame").attr("src", dest);
                $("#activity-view").animate({
                    width: "0%"
                }, 350, "swing", function () {
                }); 
                
                if (window.Android && window.Android.lockOrientation) {
                    window.Android.lockOrientation();
                }
                else if (namespace.Pepper.isWebkitHost()) {
                    webkit.messageHandlers.callbackHandler.postMessage({ "name": "lockOrientation" });
                }
            }
            else {
                $("#activity-frame").attr("src","https://dashboard.litemint.com");
            }
        }
    }

    function domShowModalPage (show, type, force) {
        if (show) {
            view.showModalPage = true;
            view.modalPageTime = 0.25;
            view.modalStep = type;
            view.modalPageTransitionTime = 0.3;
            view.mnemonicSuccess = true;
        }
        else {
            view.modalPageEndTime = 0.3;
            if (!force) {
                view.modalPageTransitionTime = 0.3;
            }
        }

        if (view.showScroller && view.scroller.type === namespace.Pepper.ScrollerType.AddAsset) {
            if (show) {
                $("#domain").hide();
            }
            else {
                $("#domain").fadeIn();
            }
        }

        if (view.showScroller && view.scroller.type === namespace.Pepper.ScrollerType.AccountSettings) {
            domShowRenameForm(false);
        }
    }

    function domShowGetFriendlyPage() {
        generateToken("e1e4c072-b534-46e7-a362-0e5edc2cd12d", (token) => {
            if (namespace.Pepper.isDesktop) {
                window.open("https://litemint.com/getfriendly/?token=" + token, "_blank");
            }
            else {
                window.location = "https://litemint.com/getfriendly/?token=" + token;
            }
        })
    }

    function domShowAboutPage(show) {
        view.globalOverlay = show;
        view.needDomUpdate = true;
        view.showAbout = show;
        if (show) {
            $("#about-page").show();
        }
        document.getElementById("about-content").scrollTop = 0;
        domUpdate();
    }

    function domShowImportForm(show) {
        if (show) {
            namespace.Pepper.importData = null;
            namespace.Pepper.importType = 0;
            namespace.Pepper.importKey = null;
            view.needDomUpdate = true;
            $("#import-form").fadeIn();
            setTimeout(() => {
                $("#import").focus();
            }, 600);
        }
        else {
            $("#import-form").hide();
        }
        $("#import").val("");
        domUpdate();
    }

    function domShowVerificationForm(show) {
        if (show) {
            view.needDomUpdate = true;
            $("#verification-form").show();
            setTimeout(() => {
                $("#words").focus();
            }, 600);
        }
        else {
            $("#verification-form").hide();
        }
        $("#words").val("");
        domUpdate();
    }

    function domShowDomainForm(show) {
        view.needRedraw = true;
        if (show) {
            view.needDomUpdate = true;
            $("#domain-form").fadeIn();
            setTimeout(() => {
                $("#domain").focus();
            }, 600);
        }
        else {
            $("#domain-form").hide();
        }
        $("#domain").val("");
        domUpdate();
    }

    function domShowRenameForm(show) {
        view.needRedraw = true;
        if (show) {
            view.needDomUpdate = true;
            $("#rename-form").fadeIn();
            $("#rename").val(view.account.name);
            $("#rename").trigger("focus");
        }
        else {
            $("#rename-form").hide();
            $("#rename").val("");
        }
        domUpdate();
    }

    function domShowTradeForm(show, slow) {
        setTimeout(() => {
            view.needRedraw = true;
            if (show) {
                view.needDomUpdate = true;
                $("#trade-price-form, #quote-amount-form, #base-amount-form").fadeIn();
            }
            else {
                $("#trade-price-form, #quote-amount-form, #base-amount-form").hide();
            }
            domUpdate();
        }, slow ? 100 : 1);
    }

    function domShowAssetPage(show) {
        view.needRedraw = true;
        if (show) {
            view.needDomUpdate = true;

            if (view.selectedAsset && view.selectedAsset.data) {
                if (view.selectedAsset.data.issuer !== "native") {
                    if (view.selectedAsset.data.issuer) {
                        $("#asset-issuer").html(namespace.Pepper.Tools.truncateKey(view.selectedAsset.data.issuer));
                    }
                    else {
                        $("#asset-issuer").html("");
                    }
                    if (view.selectedAsset.data.description) {
                        $("#asset-description").html(view.selectedAsset.data.description);
                    }
                    else {
                        $("#asset-description").html("");
                    }
                    if (view.selectedAsset.data.conditions) {
                        $("#asset-conditions").html(view.selectedAsset.data.conditions);
                    }
                    else {
                        $("#asset-conditions").html("");
                    }
                }
                else {
                    $("#asset-issuer").html("stellar.org");
                    $("#asset-issuer").click(() => {
                        window.copyIssuer("https://stellar.org");
                    });
                    $("#asset-description").html(namespace.Pepper.Resources.localeText[130]);
                    $("#asset-conditions").html(namespace.Pepper.Resources.localeText[131]);
                }
            }

            timeoutAssetPage = setTimeout(() => { $("#asset-page").show(); view.needDomUpdate = true; timeoutAssetPage = null;}, 350);
        }
        else {
            if (timeoutAssetPage) {
                clearTimeout(timeoutAssetPage);
                timeoutAssetPage = null;
            }
            $("#asset-page").hide();
        }
        domUpdate();
    }

    function domUpdateAssetPage() {
        view.needRedraw = true;
        if (view.selectedAsset && view.selectedAsset.data) {
            if (view.selectedAsset.data.issuer !== "native") {
                if (view.selectedAsset.data.issuer) {
                    $("#asset-issuer").html(namespace.Pepper.Tools.truncateKey(view.selectedAsset.data.issuer));
                }
                else {
                    $("#asset-issuer").html("");
                }
                if (view.selectedAsset.data.description) {
                    $("#asset-description").html(view.selectedAsset.data.description);
                }
                else {
                    $("#asset-description").html("");
                }
                if (view.selectedAsset.data.conditions) {
                    $("#asset-conditions").html(view.selectedAsset.data.conditions);
                }
                else {
                    $("#asset-conditions").html("");
                }
            }
            else {
                $("#asset-issuer").html("stellar.org");
                $("#asset-issuer").click(() => {
                    window.copyIssuer("https://stellar.org");
                });
                $("#asset-description").html(namespace.Pepper.Resources.localeText[130]);
                $("#asset-conditions").html(namespace.Pepper.Resources.localeText[131]);
            }
        }
    }

    function domShowAddressForm(show) {
        view.needRedraw = true;
        if (show) {
            view.needDomUpdate = true;
            $("#address-form").show();
            setTimeout(() => {
                $("#address").focus();
            }, 600);
        }
        else {
            $("#address-form").hide();
        }
        $("#address").val("");
        $("#memo").val("");
        domUpdate();
    }

    function domUpdateLanguage() {
        $("#about-title").html("<img src='res/img/heart.png' /> " + namespace.Pepper.Resources.localeText[39] + "<img id='about-close-img' style='float:right;' src='res/img/close.png' />");
        $("#about-page-devby").html(namespace.Pepper.Resources.localeText[92]);
        $("#about-page-distby").html(namespace.Pepper.Resources.localeText[93]);
        $("#about-page-license").html(namespace.Pepper.Resources.localeText[94]);
        $("#about-page-depends").html(namespace.Pepper.Resources.localeText[95]);
        $("#about-page-version").html("v" + namespace.config.version);
        $("#about-page-warning").html(namespace.Pepper.Resources.localeText[96]);
        $("#about-page-trade-warning").html(namespace.Pepper.Resources.localeText[97]);
        $("#about-page-legal").html(namespace.Pepper.Resources.localeText[98]);
        $("#about-page-terms").html(namespace.Pepper.Resources.localeText[99]);
        $("#about-page-privacy").html(namespace.Pepper.Resources.localeText[100]);
        $("#about-page-help").html(namespace.Pepper.Resources.localeText[101]);
        $("#about-page-support").html(namespace.Pepper.Resources.localeText[102]);
        $("#about-page-security").html(namespace.Pepper.Resources.localeText[103]);
        $("#about-page-view-git").html(namespace.Pepper.Resources.localeText[104]);
        $("#about-page-available-git").html(namespace.Pepper.Resources.localeText[105]);
        $("#words").attr("placeholder", namespace.Pepper.Resources.localeText[30]);
        $("#address").attr("placeholder", namespace.Pepper.Resources.localeText[52]);
        $("#memo").attr("placeholder", namespace.Pepper.Resources.localeText[53]);
        $("#domain").attr("placeholder", namespace.Pepper.Resources.localeText[124]);
        $("#asset-issuer-title").html(namespace.Pepper.Resources.localeText[127]);
        $("#asset-description-title").html(namespace.Pepper.Resources.localeText[128]);
        $("#asset-conditions-title").html(namespace.Pepper.Resources.localeText[129]);
        $("#rename").attr("placeholder", namespace.Pepper.Resources.localeText[146]);
        $("#import").attr("placeholder", namespace.Pepper.Resources.localeText[149]);
        $("#about-page-rate").html(namespace.Pepper.Resources.localeText[158]);
        $("#about-page-rate-text").html(namespace.Pepper.Resources.localeText[159]);

        if (namespace.Pepper.isDesktop) {
            $("#signup-page-text1").html(namespace.Pepper.Resources.localeText[205]);
            $("#signup-page-text2").html(namespace.Pepper.Resources.localeText[206]);
            $("#signup-page-text3").html(namespace.Pepper.Resources.localeText[207]);
        }
    }

    function domGenerateCode() {
        if (view && view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.Receive) {
            let key = view.getActiveCarouselItem().asset.deposit || namespace.Core.currentAccount.keys.publicKey();
            $("#qrcode").qrcode({
                "text": key,
                "fill": "#322f42",
                "background": "#fff",
                "size": 720
            });
            namespace.Pepper.Resources.qrCodeImage = $("#qrcode")[0];
            namespace.Pepper.Resources.qrCodeText = namespace.Pepper.Tools.truncateKey(key);
        }
    }

    function domTogglePasswordVisibility() {
        var elem = document.getElementById("import");
        if (elem.type === "password") {
            elem.type = "text";
        } else {
            elem.type = "password";
        }
    }

    // Document has loaded.
    $(document).ready(function () {

        // Initialize Litemint.
        namespace.initialize();

        // Control decimal count on trade inputs.
        let inputs = document.querySelectorAll(".trade-input");
        inputs.forEach(function (elem) {
            elem.addEventListener("input", function () {
                let dec = elem.getAttribute("decimals");
                let regex = new RegExp("(\\.\\d{" + dec + "})\\d+", "g");
                elem.value = elem.value.replace(regex, "$1");
            });
        });
    });

    // Window is resized.
    $(window).resize(function () {
        // Reset the UI display.
        namespace.Pepper.resetDisplay();
    });

    // Prevent scrolling when moving.
    $(document).on("touchmove", function (e) {
        e.preventDefault();
    });

    // Handle about rate button click.
    $("#about-page-rate, #about-rate-icon").click(function (e) {
        if (window.Android) {
            window.Android.rate();
        }
        else if (namespace.Pepper.isWebkitHost()) {
            webkit.messageHandlers.callbackHandler.postMessage({ "name": "rate" });
        }
        else {
            window.open("https://www.facebook.com/litemint/reviews/", "_blank");
        }
    });

    // Handle about-title click.
    $("#about-title").click(function (e) {
        domShowAboutPage(false);
    });

    // Handle words input.
    $("#words").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#words").blur();
            e.preventDefault();
        }
    });

    // Handle rename input.
    $("#rename").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#rename").trigger("blur");
            domShowRenameForm(false);
            e.preventDefault();
        }
    });

    $("#rename").blur(function (e) {
        const value = $("#rename").val();
        if (value !== "") {
            const data = namespace.Pepper.loadWalletData();
            data.accounts[data.lastaccount].name = value;
            view.account = data.accounts[data.lastaccount];
            namespace.Pepper.saveWalletData(data);
        }
        e.preventDefault();
    });

    // Handle domain input.
    $("#domain").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#domain").blur();
            view.scroller.loading = true;
            view.needRedraw = true;
            view.scroller.items = [];
            StellarSdk.StellarTomlResolver.resolve($("#domain").val())
                .then(stellarToml => {
                    view.scroller.loading = false;
                    for (let i = 0; i < stellarToml.CURRENCIES.length; i += 1) {
                        let currency = stellarToml.CURRENCIES[i];
                        let item = namespace.Core.currentAccount.assets.find(x => x.code === currency.code && x.issuer === currency.issuer);
                        if (!item) {
                            let nativeAsset = namespace.Core.currentAccount.assets.find(x => x.code === "XLM" && x.issuer === "native");
                            if (!nativeAsset) {
                                nativeAsset = view.placeHolderAsset;
                            }
                            let canAdd = namespace.Core.currentAccount
                                .getMaxSend(nativeAsset.balance, nativeAsset) >= namespace.Core.currentAccount.getTrustBaseFee()
                                ? true : false;
                            view.scroller.items.push({
                                "data": new namespace.Core.Asset(currency.issuer, currency.code, 0),
                                "hasAdd": canAdd
                            });
                        }
                        else {
                            view.scroller.items.push({
                                "data": item,
                                "hasAdd": false
                            });
                        }
                    }
                    view.needRedraw = true;
                })
                .catch(error => {
                    view.scroller.loading = false;
                    view.needRedraw = true;
                });
            e.preventDefault();
        }
    });

    // Handle address input.
    $("#address").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#memo").focus();
            e.preventDefault();
        }
    });

    // Handle memo input.
    $("#memo").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#memo").blur();
            e.preventDefault();
        }
    });

    // Handle import input.
    $("#import").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#import").blur();
            e.preventDefault();
        }
    });

    // Handle trade price input.
    $("#trade-price").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#base-amount").focus();
            e.preventDefault();
        }
    });

    // Handle base amount input.
    $("#base-amount").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#quote-amount").focus();
            e.preventDefault();
        }
    });

    // Handle quote amount input.
    $("#quote-amount").keydown(function (e) {
        if (e.keyCode === 13) {
            $("#quote-amount").blur();
            e.preventDefault();
        }
    });

    $("#trade-price").on("input", function () {
        updateTradeInputs($("#trade-price").val());
    });

    $("#base-amount").on("input", function () {
        updateTradeInputs(null, $("#base-amount").val());
    });

    $("#quote-amount").on("input", function () {
        updateTradeInputs(null, null, $("#quote-amount").val());
    });

    $("#quote-amount, #base-amount, #trade-price").on("focus", function () {
        namespace.Core.currentAccount.queuedOrder = null;
    });

    $("#handleBtn").click(function () {
        domShowApp(false);
    });

    // Native callback: back button pressed.
    window.onBackButtonPressed = function () {
        return namespace.Pepper.onBackButtonPressed();
    };

    // Native callback: QR Code.
    window.onQRCodeReceived = function (code) {
        code = code.replace("mag:", "");
        if (view) {
            if (view.modalStep === namespace.Pepper.WizardType.ImportAccount
                && view.showModalPage) {
                $("#import").val(code);
            }
            else if (view.isActivityMode && view.activityType === namespace.Pepper.ActivityType.SelectSendRecipient) {
                $("#address").val(code);
                let inp = $("#address")[0];
                if (inp.createTextRange) {
                    var part = inp.createTextRange();
                    part.move("character", 0);
                    part.select();
                } else if (inp.setSelectionRange) {
                    inp.setSelectionRange(0, 0);
                }
                $("#address").trigger("focus");
            }
            else {
                if (window.Android) {
                    window.Android.copyToClipboard("qrcode", code, namespace.Pepper.Resources.localeText[121]);
                }
                else if (namespace.Pepper.isWebkitHost()) {
                    webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "qrcode", "data": code, "message": namespace.Pepper.Resources.localeText[121] });
                }
                else {
                    namespace.Pepper.copyToClipboard(code, namespace.Pepper.Resources.localeText[121]);
                }
            }
        }
    };

    // Copy the issuer code.
    window.copyIssuer = function (issuer) {
        if (window.Android) {
            window.Android.copyToClipboard("issuer", issuer, namespace.Pepper.Resources.localeText[122]);
        }
        else if (namespace.Pepper.isWebkitHost()) {
            webkit.messageHandlers.callbackHandler.postMessage({ "name": "copyToClipboard", "label": "issuer", "data": issuer, "message": namespace.Pepper.Resources.localeText[122] });
        }
        else {
            namespace.Pepper.copyToClipboard(issuer, namespace.Pepper.Resources.localeText[122]);
        }
    };

    window.addEventListener("message", function (event) {
        if (typeof event.data === "string") {
            if (event.data === "litemint_app_requestad") {
                if (!namespace.config.disableAds) {
                    if (window.Android) {
                        if(window.Android.showAd){
                            window.Android.showAd();
                        }
                    }
                    else if(namespace.Pepper.isDesktop) {
                        this.setTimeout(() => {requestOutstreamAds(true);}, 100);  
                    }
                }
            }
            else if (event.data === "litemint_app_close") {
                domShowApp(false);
            }
            else if (event.data === "litemint_app_ready") {
                $('#activity-loader').fadeOut();
            }
        }
    });

})(window.Litemint = window.Litemint || {});
