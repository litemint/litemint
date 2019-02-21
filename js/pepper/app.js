/**
 * @overview Litemint Pepper App implementation.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
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
        if (rotateScreen || !view || showLoader ||
            view.scrollerTime || view.scrollerEndTime || view.showPinLoader
            || view.modalPageEndTime) {
            return "stay";
        }

        view.needRedraw = true;

        // Close the modal page if opened.
        if (view.showModalPage) {
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
            return "stay";
        }
        else if (view.showAbout) {
            domShowAboutPage(false);
            return "stay";
        }
        else if (view.isSendMode) {
            view.closeSendPage(() => { domShowAddressForm(false); });
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
        else if (!view.isSendMode && !view.isDashboardMenu && !view.isPinMenu && !view.showAbout) {
            if (down && view.list.offset < view.list.maxOffset) {
                view.list.offset += view.unit;
            }
            else if (!down && view.list.offset > 0) {
                view.list.offset -= view.unit;
            }
        }
        view.needRedraw = true;
    };

    function onLoad(current, total) {
        loadingstate = { "current": current, "total": total };
        if (!readyTrigger) {
            readyTrigger = true;
            if (window.Android) {
                window.Android.setReady();
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
                view.onCarouselItemChanged = function () {
                    domGenerateCode();
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
                    loaderText = loadingstate ? loadingstate.current.toString() + "%" : "0%";
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
            switch (testType) {
                case 0:
                    item.selected = false;
                    item.hover = false;
                    item.overAddBtn = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y - view.scroller.offset, item.x + item.width, item.y + item.height - view.scroller.offset)) {
                        item.selected = true;
                        selected = true;

                        if (view.scroller.type === namespace.Pepper.ScrollerType.AddAsset && !namespace.Pepper.queryAsset) {
                            if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 1.7, item.y + view.unit * 0.25 - view.scroller.offset, item.x + view.unit * 1.7 + view.unit * 2.4, item.y + view.unit * 0.25 - view.scroller.offset + view.unit * 0.7)) {
                                item.overAddBtn = true;
                            }
                        }
                    }
                    break;
                case 1:
                    item.hover = false;
                    if (namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x, item.y - view.scroller.offset, item.x + item.width, item.y + item.height - view.scroller.offset)) {
                        item.hover = true;

                        if (view.scroller.type === namespace.Pepper.ScrollerType.AddAsset) {
                            if (!namespace.Pepper.Tools.pointInRect(point.x, point.y, item.x + view.unit * 1.7, item.y + view.unit * 0.25 - view.scroller.offset, item.x + view.unit * 1.7 + view.unit * 2.4, item.y + view.unit * 0.25 - view.scroller.offset + view.unit * 0.7)) {
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
                    domShowRenameForm(false);
                    view.scrollerEndTime = 0.3;
                    view.discardedPanel = true;
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
                    || view.scroller.type === namespace.Pepper.ScrollerType.FilterMenu
                        || view.scroller.type === namespace.Pepper.ScrollerType.AccountSettings)) {
                    if (view.scroller.type !== namespace.Pepper.ScrollerType.AccountSettings) {
                        view.scrollerEndTime = 0.3;
                        view.discardedPanel = true;
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
                    if (!clicked && !view.isSendMode && !namespace.Core.currentAccount.watchOnly) {
                        clicked = testElement(0, point, view.sendBtn, false);
                    }
                    if (!clicked && !view.isSendMode) {
                        clicked = testElement(0, point, view.receiveBtn, false);
                    }
                    if (!clicked && !view.isSendMode && !namespace.Core.currentAccount.watchOnly) {
                        clicked = testElement(0, point, view.tradeBtn, false);
                    }
                    if (!clicked) {
                        clicked = testElement(0, point, view.assetPicker, false);
                    }
                    if (!clicked && !view.isSendMode) {
                        clicked = testElement(0, point, view.transactionsBtn, false);
                    }
                    if (!clicked && !view.isSendMode) {
                        clicked = testElement(0, point, view.assetsBtn, false);
                    }
                    if (!clicked && !view.isSendMode) {
                        clicked = testElement(0, point, view.moreBtn, false);
                    }
                    if (!clicked && !view.isSendMode) {
                        clicked = testElement(0, point, view.chartBtn, false);
                    }
                    if (!clicked && !view.isSendMode) {
                        clicked = testElement(0, point, view.filterBtn, false);
                    }
                    if (!clicked && !view.isSendMode && !namespace.Core.currentAccount.watchOnly) {
                        clicked = testElement(0, point, view.addAssetBtn, false);
                    }
                    if (!clicked) {
                        clicked = testElement(0, point, view.menuBtn, false);
                    }
                    if (!clicked) {
                        clicked = testElement(0, point, view.accountBtn, false);
                    }
                    if (!clicked && view.carousel.offset === view.carousel.anchor) {
                        if (!view.isSendMode || view.sendStep === 0 || view.sendStep === 5 || view.sendStep === 6) {
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
                        if (view.isSendMode) {
                            testElement(0, point, view.numPadSendBtn, false);
                            testElement(0, point, view.numPadCloseBtn, false);

                            if (view.sendStep === 0) {
                                for (let i = 0; i < view.numPad.length; i += 1) {
                                    testElement(0, point, view.numPad[i], false);
                                }
                            }
                            else if (view.sendStep === 1) {
                                testElement(0, point, view.bookBtn, false);
                                testElement(0, point, view.pasteBtn, false);
                                testElement(0, point, view.qrBtn, false);
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
                        testElement(1, point, view.assetPicker, isPointerDown);

                        if (view.isSendMode) {
                            testElement(1, point, view.numPadSendBtn, isPointerDown);
                            testElement(1, point, view.numPadCloseBtn, isPointerDown);

                            if (view.sendStep === 0) {
                                for (let i = 0; i < view.numPad.length; i += 1) {
                                    testElement(1, point, view.numPad[i], isPointerDown);
                                }
                            }
                            else if (view.sendStep === 1) {
                                testElement(1, point, view.bookBtn, isPointerDown);
                                testElement(1, point, view.pasteBtn, isPointerDown);
                                testElement(1, point, view.qrBtn, isPointerDown);
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
                        const memonic = $("#words").val().split(" ");
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
                                            "data": new namespace.Core.Asset(namespace.Pepper.Resources.currentSponsor.issuer, namespace.Pepper.Resources.currentSponsor.code),
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

                const data = namespace.Pepper.loadWalletData();
                testScroller(2, point, view.scroller, isPointerDown, function (item, index) {
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
                                            !namespace.Core.currentAccount.nobackup) {
                                            let nothingUpMySleeve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
                                            let result = namespace.Core.currentAccount.keys.sign(nothingUpMySleeve);
                                            let signedData = namespace.Core.Utils.bytesToHex(result);

                                            if (namespace.Pepper.isDesktop) {
                                                window.open("https://litemint.com/getfriendly/?sign=" + signedData + "&public=" + namespace.Core.currentAccount.keys.publicKey(), "_blank");
                                            }
                                            else {
                                                window.location = "https://litemint.com/getfriendly/?sign=" + signedData + "&public=" + namespace.Core.currentAccount.keys.publicKey();
                                            }
                                        }
                                        else {
                                            if (!namespace.Core.currentAccount.nobackup && window.Android) {
                                                window.Android.copyToClipboard("address", namespace.Core.currentAccount.friendlyAddress, namespace.Pepper.Resources.localeText[122]);
                                            }
                                            else if (!namespace.Core.currentAccount.nobackup && parent) {
                                                parent.postMessage("litemint_copy:" + namespace.Core.currentAccount.friendlyAddress, "*");
                                                parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
                                            }
                                        }
                                    }
                                    else if (item.id === view.scroller.items.length - 2) {
                                        if (!namespace.Core.currentAccount.nobackup) {
                                            view.closeSendPage(() => { domShowAddressForm(false); });
                                            domShowModalPage(true, namespace.Pepper.WizardType.BackupStep1);
                                        }
                                    }
                                    else if (item.id === view.scroller.items.length - 1) {
                                        if (view.deleteStep === 3) {
                                            setTimeout(function () {
                                                data.accounts.splice(data.lastaccount, 1);
                                                data.lastaccount = -1;
                                                namespace.Pepper.saveWalletData(data);
                                                view.closeSendPage(() => { domShowAddressForm(false); }, true);
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
                            case namespace.Pepper.ScrollerType.AssetsMenu:
                                if (item.enabled) {
                                    console.log("clicked menu item");
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
                                                else if (parent) {
                                                    parent.postMessage("litemint_copy:" +
                                                        namespace.Pepper.Resources.localeText[126] + " " + carouselitem.asset.code + "\n" +
                                                        namespace.Pepper.Resources.localeText[133] + " " + carouselitem.asset.issuer + "\n" +
                                                        namespace.Pepper.Resources.localeText[134] + " " + (carouselitem.asset.deposit || namespace.Core.currentAccount.keys.publicKey()), "*");
                                                    parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
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
                                                            console.log(carouselitem.asset.code + " asset removed");
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
                            case namespace.Pepper.ScrollerType.FilterMenu:
                                console.log("clicked filter item");
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
                                    view.loadScroller(namespace.Pepper.ScrollerType.Languages);
                                    break;
                                case 2:
                                    domShowAboutPage(true);
                                    break;
                                case 3:
                                    view.closeSendPage(() => { domShowAddressForm(false); }, true);
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
                            if (!called && view.scroller.canClick) {
                                called = true;
                            }
                        });
                    }
                    else {
                        if (!namespace.Core.currentAccount.watchOnly) {
                            testElement(2, point, view.sendBtn, isPointerDown, function () {
                                if (!called) {
                                    called = true;
                                    view.sendStep = 0;
                                    view.isSendMode = true;
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
                                view.clickedReceived = true;
                                view.sendStep = 5;
                                view.isSendMode = true;
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
                                   // called = true;
                                    if (window.Android) {
                                        window.Android.showToast(namespace.Pepper.Resources.localeText[160]);
                                    }
                                    else if (parent) {
                                        parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[160], "*");
                                    }
                                }

                                if (!called) {
                                    called = true;
                                    view.clickedReceived = true;
                                    view.sendStep = 6;
                                    view.isSendMode = true;
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
                        }

                        testElement(2, point, view.assetPicker, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                view.loadScroller(namespace.Pepper.ScrollerType.Assets);
                            }
                        });

                        testElement(2, point, view.menuBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                view.isDashboardMenu = true;
                                view.closeSendPage(() => { domShowAddressForm(false); }, true);
                            }
                        });

                        testElement(2, point, view.accountBtn, isPointerDown, function () {
                            if (!called) {
                                called = true;
                                view.closeSendPage(() => { domShowAddressForm(false); });
                                view.loadScroller(namespace.Pepper.ScrollerType.AccountSettings);
                            }
                        });

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
                            if (view.isSendMode) {

                                let close = false;
                                testElement(2, point, view.numPadCloseBtn, isPointerDown, function () {
                                    view.closeSendPage(() => { domShowAddressForm(false); });
                                    close = true;
                                });

                                if (view.sendStep === 2 && view.isSendMode && view.numPad.length) {
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
                                                        "data": new namespace.Core.Asset(namespace.Pepper.Resources.currentSponsor.issuer, namespace.Pepper.Resources.currentSponsor.code),
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
                                    switch (view.sendStep) {
                                        case 0:
                                            if (!Number.isNaN(Number(view.sendAmount)) && Number(view.sendAmount) > 0) {
                                                if (Number(namespace.Core.currentAccount.getMaxSend(view.getActiveCarouselItem().asset.balance, !view.carousel.active)) < view.sendAmount) {
                                                    view.amountErrorTime = 1;
                                                }
                                                else {
                                                    view.sendStep += 1;
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
                                        case 1:
                                            if ($("#address").val() !== "") {
                                                view.sendStep += 1;
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
                                                            if (view.isSendMode) {
                                                                view.sendTransition = 0.3;
                                                                view.sendStep += 1;
                                                                view.sendErrorTxt = msg;
                                                                console.error(JSON.stringify(msg));
                                                            }
                                                        }
                                                        else {
                                                            if (view.isSendMode) {
                                                                view.sendTransition = 0.3;
                                                                view.sendStep += 1;
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
                                        case 2:
                                            break;
                                        case 3:
                                            view.isSendMode = false;
                                            view.sendFormEndTime = 0.5;
                                            view.list.startTime = 0.5;
                                            break;
                                    }
                                });

                                if (view.sendStep === 0) {
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
                                else if (view.sendStep === 1) {
                                    testElement(2, point, view.bookBtn, isPointerDown, function () {
                                        $("#address-form").hide();
                                        view.loadScroller(namespace.Pepper.ScrollerType.Addresses);
                                    });

                                    testElement(2, point, view.pasteBtn, isPointerDown, function () {
                                        if (window.Android) {
                                            window.onRetrieveClipboardData = function (data) {
                                                $("#address").val(data);
                                                $("#address").trigger("focus");
                                            };
                                            window.Android.retrieveClipboardData();
                                        }
                                        else if (parent) {
                                            parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[160], "*");
                                        }
                                    });

                                    testElement(2, point, view.qrBtn, isPointerDown, function () {
                                        if (window.Android) {
                                            window.Android.scanQRCode();
                                        }
                                        else if (parent) {
                                            parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[160], "*");
                                        }
                                    });
                                }
                                else if (!close && view.sendStep === 5 && view.getActiveCarouselItem()) {
                                    if (view.numPadCloseBtn.y + view.unit < point.y) {
                                        let key = view.getActiveCarouselItem().asset.deposit || namespace.Core.currentAccount.keys.publicKey();
                                        if (window.Android) {
                                            window.Android.copyToClipboard("address", key, namespace.Pepper.Resources.localeText[122]);
                                        }
                                        else if (parent) {
                                            parent.postMessage("litemint_copy:" + key, "*");
                                            parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
                                        }
                                        console.info(key);
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

                                                    if (namespace.Pepper.isDesktop) {
                                                        window.open(namespace.config.opsEndPoint + "/" + item.data.id, "_blank");
                                                    }
                                                    else {
                                                        window.location = namespace.config.opsEndPoint + "/" + item.data.id;
                                                    }
                                                }
                                                else if (item.data.memo && item.overMemoBtn) {
                                                    item.overMemoBtn = false;
                                                    if (window.Android) {
                                                        window.Android.copyToClipboard("memo", item.data.memo, namespace.Pepper.Resources.localeText[123] + item.data.memo);
                                                    }
                                                    else if (parent) {
                                                        parent.postMessage("litemint_copy:" + item.data.memo, "*");
                                                        parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[123] + item.data.memo, "*");
                                                    }
                                                    console.log(item.data.memo);
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
                                                            else if (parent) {
                                                                if (item.data.to === namespace.Core.currentAccount.keys.publicKey()) {
                                                                    parent.postMessage("litemint_copy:" + item.data.from, "*");
                                                                    parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
                                                                }
                                                                else {
                                                                    parent.postMessage("litemint_copy:" + item.data.to, "*");
                                                                    parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
                                                                }
                                                            }
                                                            break;
                                                        case "create_account":
                                                            if (window.Android) {
                                                                window.Android.copyToClipboard("address", item.data.source_account, namespace.Pepper.Resources.localeText[122]);
                                                            }
                                                            else if (parent) {
                                                                parent.postMessage("litemint_copy:" + item.data.source_account, "*");
                                                                parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
                                                            }
                                                            break;
                                                        case "change_trust":
                                                        case "allow_trust":
                                                            if (window.Android) {
                                                                window.Android.copyToClipboard("address", item.data.asset_issuer, namespace.Pepper.Resources.localeText[122]);
                                                            }
                                                            else if (parent) {
                                                                parent.postMessage("litemint_copy:" + item.data.asset_issuer, "*");
                                                                parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
                                                            }
                                                            break;
                                                    }
                                                }
                                                break;
                                            case namespace.Pepper.ListType.Assets:
                                                console.log("clicked asset item" + index);
                                                if (!item.data.balance && item.overAddBtn && !namespace.Pepper.queryAsset && item.hasAdd) {
                                                    item.overAddBtn = false;
                                                    namespace.Pepper.queryAsset = item.data;
                                                    var stellarNet = new namespace.Core.StellarNetwork();
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
                    || item.type === "manage_offer"
                    || item.type === "path_payment")
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
                        && namespace.Core.currentAccount.getMaxSend(nativeAsset.balance, true) >= namespace.Core.currentAccount.getTrustBaseFee()
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
                    && namespace.Core.currentAccount.getMaxSend(nativeAsset.balance, true) >= namespace.Core.currentAccount.getTrustBaseFee()
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

        view.resetCarousel();
        view.page = namespace.Pepper.PageType.Dashboard;

        stellarNet.loadDefaultAssets();
        stellarNet.attachAccount((full, indexes) => {
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
            });
        }).then(function () {
            view.error = namespace.Pepper.ViewErrorType.None;
            view.closeSendPage(() => { domShowAddressForm(false); });
            view.resetList(namespace.Pepper.ListType.Transactions);
            loadCarousel();
            if (cb) {
                cb();
            }
        }).catch(function (err) {
            if (cb) {
                cb(err);
            }
        });
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
    }

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

            if (view.isSendMode) {
                $("#address-form").css({ top: (view.viewport.y + view.unit * 5.5) / pixelRatio, left: (view.viewport.x + view.unit * 0.5) / pixelRatio });
                $("#address-form").width((view.viewport.width - view.unit) / pixelRatio);
                $("#address-form").height(view.unit * 2.5 / pixelRatio);
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
    }

    function domGenerateCode() {
        if (view && view.isSendMode && view.sendStep === 5) {
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
                                .getMaxSend(nativeAsset.balance, true) >= namespace.Core.currentAccount.getTrustBaseFee()
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
            else if (view.isSendMode && view.sendStep === 1) {
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
                else if (parent) {
                    parent.postMessage("litemint_copy:" + code, "*");
                    parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[121], "*");
                }
            }
        }
    };

    // Copy the issuer code.
    window.copyIssuer = function (issuer) {
        if (window.Android) {
            window.Android.copyToClipboard("issuer", issuer, namespace.Pepper.Resources.localeText[122]);
        }
        else if (parent) {
            parent.postMessage("litemint_copy:" + issuer, "*");
            parent.postMessage("litemint_toast:" + namespace.Pepper.Resources.localeText[122], "*");
        }
    };

})(window.Litemint = window.Litemint || {});
