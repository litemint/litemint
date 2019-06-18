// Copyright 2017 Google Inc. All Rights Reserved.
// You may study, modify, and use this example for any purpose.
// Note that this example is provided "as is", WITHOUT WARRANTY
// of any kind either expressed or implied.

var primaryTag = "//ads.ad4game.com/www/delivery/vast.php?zoneid=63750&siteurl=https%253A%252F%252Fpie.ai";
var secondaryTag = "//ads.ad4game.com/www/delivery/vast.php?zoneid=63750&siteurl=https%253A%252F%252Fpie.ai";
var tertiaryTag = "//ads.ad4game.com/www/delivery/vast.php?zoneid=63750&siteurl=https%253A%252F%252Fpie.ai";

var adsController;
var adRequestTime = 0;
var errorCount = 0;

/**
 * Initialize the Outstream SDK.
 */
var initOutstream = function () {
    var outstreamContainer = document.getElementById('outstreamContainer');
    if (typeof google !== "undefined") {
        adsController = new google.outstream.AdsController(outstreamContainer, onOutstreamAdLoaded, onOutstreamAdDone);
    }
    else {
        Litemint.Spear.adsDisabled = true;
    }
    $("#outstreamContainer").hide();
};

/**
 * Request ad. Must be invoked by a user action for mobile devices.
 */
function requestOutstreamAds(primary, count) {
    if (adsController) {
        adsController.initialize();

        // Request ads
        var adTagUrl = primary ? primaryTag : (count === 1 ? secondaryTag : tertiaryTag);
        console.log("Requesting " + adTagUrl);

        errorCount = count ? count : 0;
        adRequestTime = Date.now();

        adsController.requestAds(adTagUrl);
    }
}

/**
 * Allow resizing of the current ad.
 */
function resizeOutstream(newWidth, newHeight) {
    if (adsController) {
        adsController.resize(newWidth, newHeight);
    }
}

/*
 * Callback for when ad has completed loading.
 */
function onOutstreamAdLoaded() {
    playOutstreamAds();
}

/*
 * Callback for when ad has completed playback.
 */
function onOutstreamAdDone() {
    // Show content
    Litemint.Spear.showingAds = false;
    $("#outstreamContainer").hide();

    var elapsed = Date.now() - adRequestTime;
    if (elapsed < 3000) {  // If the callback is called within less than 3 seconds we assume an error.
        if (errorCount < 2) {
            console.log("failed, using fallback.");
            requestOutstreamAds(false, errorCount + 1);
        }
    }
    else {
        console.log("Ad played successfully.");
    }
}

/*
 * Playback video ad
 */
function playOutstreamAds() {
    if (adsController) {
        Litemint.Spear.showingAds = true;
        Litemint.Spear.lastShowTime = Date.now();
        $("#outstreamContainer").show();
        adsController.showAd();
    }
}
