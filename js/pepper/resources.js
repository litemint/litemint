/**
 * @overview Litemint Pepper Resources implementation.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

(function (namespace) {
    "use strict";

    /**
     * Contains the strings for currently loaded language.
     * @member localeText
     * @memberof Litemint.Pepper.Resources
    */
    namespace.Pepper.Resources.localeText = namespace.Pepper.Resources
        .languagePacks[namespace.Pepper.Resources.defaultLanguage].text.slice();
    namespace.Pepper.Resources.languageId = namespace.Pepper.Resources.defaultLanguage;

    /**
     * UI Primary color.
     * @member primaryColor
     * @memberof Litemint.Pepper.Resources
    */
    namespace.Pepper.Resources.primaryColor = "rgb(42, 193, 188)";

    /**
     * Image file references.
     * @member imageFiles
     * @memberof Litemint.Pepper.Resources
    */
    namespace.Pepper.Resources.imageFiles = {
        "backLightImage": "backlight.png",
        "backDarkImage": "backdark.png",
        "switchLightImage": "switchlight.png",
        "switchDarkImage": "switchdark.png",
        "globeImage": "globe.png",
        "keyImage": "key.png",
        "peopleImage": "people.png",
        "personImage": "person.png",
        "questionImage": "question.png",
        "arrowLeftImage": "arrowleft.png",
        "arrowRightImage": "arrowright.png",
        "logoSmallImage": "logosmall.png",
        "walletImage": "wallet.png",
        "successImage": "success.png",
        "errorImage": "error.png",
        "heartImage": "heart.png",
        "closeImage": "close.png",
        "syncImage": "sync.png",
        "shuffleDarkImage": "shuffledark.png",
        "shuffleLightImage": "shufflelight.png",
        "stellarImage": "stellar.png",
        "shieldImage": "shield.png",
        "warningImage": "warning.png",
        "starImage": "star.png",
        "sendImage": "send.png",
        "receiveImage": "receive.png",
        "chartImage": "chart.png",
        "moreImage": "more.png",
        "tradeImage": "trade.png",
        "moreDarkImage": "moredark.png",
        "filterImage": "filter.png",
        "accountImage": "account.png",
        "launchImage": "launch.png",
        "copyImage": "copy.png",
        "closeDarkImage": "closedark.png",
        "bookImage": "book.png",
        "pasteImage": "paste.png",
        "qrImage": "qr.png",
        "memoImage": "memo.png",
        "syncDarkImage": "syncdark.png",
        "addImage": "add.png",
        "unlinkImage": "unlink.png",
        "linkImage": "link.png",
        "success2Image": "success2.png",
        "optImage": "optunselected.png",
        "optSelImage": "optselected.png",
        "manageImage": "manage.png",
        "receiveArrowImage": "receivearrow.png",
        "optionsImage": "options.png",
        "penImage": "pen.png",
        "mergeImage": "merge.png",
        "watchImage": "watch.png",
        "rotateImage": "rotate.png",
        "searchImage": "search.png",
        "deleteImage": "delete.png",
        "deleteLightImage": "deletelight.png",
        "currencyImage": "currency.png",
        "seamlessImage": "seamless.png",
        "visibleImage": "visible.png",
        "importImage": "import.png",
        "notificationImage": "notification.png",
        "keyboardImage": "keyboard.png",
        "toggleonImage": "toggleon.png",
        "toggleoffImage": "toggleoff.png",
        "lmtAccountImage": "lmtaccount.png",
        "marketImage": "market.png"
    };

})(window.Litemint = window.Litemint || {});
