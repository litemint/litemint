#!/bin/sh

OUT="dist/"
DEBUG=false
JSDOC=""

set -e

for i in "$@"
do
case $i in
    -o=*|--out=*)
    OUT="${i#*=}"
    shift
    ;;
    -j=*|--jsdoc=*)
    JSDOC="${i#*=}"
    shift
    ;;
    --compiler=*)
    COMPILER="${i#*=}"
    shift
    ;;
    --compressor=*)
    COMPRESSOR="${i#*=}"
    shift
    ;;
    --debug)
    DEBUG=true
    shift
    ;;
    *)
    ;;
esac
done
OUT=${OUT%/}/

if [ -z "$COMPILER" ]; then
    echo "Compiler path unknown."
    echo "--compiler=path/closure-compiler.jar or export COMPILER=path/closure-compiler.jar"
    exit 1
fi

if [ -z "$COMPRESSOR" ]; then
    echo "Compressor path unknown."
    echo "--compressor=path/yui-compressor.jar or export COMPRESSOR=path/yui-compressor.jar"
    exit 1
fi

# Clean output folder.
if [ -d "OUT" ]; then
    echo "Build directory "${OUT}" already exists. Cleaning..."
    rm -r ${OUT}*
    else
    echo "Build directory set to "${OUT}
fi

if [ "$DEBUG" = true ] ; then
    echo -e "\033[1;33m Debug build configuration enabled \033[0m"
fi

# Compile litemint core.
echo "Compiling litemint core..."
java -jar $COMPILER \
--compilation_level SIMPLE_OPTIMIZATIONS \
--hide_warnings_for js/thirdparty \
--js js/license.js \
--js js/thirdparty/crypto/wordlist/wordlist_english.js \
--js js/thirdparty/crypto/wordlist/wordlist_french.js \
--js js/thirdparty/crypto/wordlist/wordlist_italian.js \
--js js/thirdparty/crypto/wordlist/wordlist_japanese.js \
--js js/thirdparty/crypto/wordlist/wordlist_korean.js \
--js js/thirdparty/crypto/wordlist/wordlist_spanish.js \
--js js/thirdparty/crypto/wordlist/wordlist_chinese_traditional.js \
--js js/thirdparty/crypto/wordlist/wordlist_chinese_simplified.js \
--js js/thirdparty/crypto/elliptic.min.js \
--js js/thirdparty/crypto/base58.min.js \
--js js/thirdparty/crypto/aes.min.js \
--js js/thirdparty/crypto/bip39.min.js \
--js js/thirdparty/stellar/stellar-sdk.min.js \
--js js/core/decl.js \
--js js/core/utils.js \
--js js/core/keytool.js \
--js js/core/storage.js \
--js js/core/account.js \
--js js/core/network.js \
--js_output_file=${OUT}core.min.js

# Compile litemint flavors.

# pepper
echo "Compiling litemint pepper flavor..."
java -jar $COMPILER \
--compilation_level SIMPLE_OPTIMIZATIONS \
--hide_warnings_for js/thirdparty \
--js js/license.js \
--js js/thirdparty/ui/jquery-2.1.1.min.js \
--js js/thirdparty/ui/jquery.mobile.custom.min.js \
--js js/thirdparty/ui/jquery-qrcode.min.js \
--js js/thirdparty/ui/chart.min.js \
--js js/pepper/decl.js \
--js js/pepper/tools.js \
--js js/pepper/languages.js \
--js js/pepper/resources.js \
--js js/pepper/elements.js \
--js js/pepper/view.js \
--js js/pepper/app.js \
--js_output_file=${OUT}pepper.min.js

# spear
echo "Compiling litemint spear flavor..."
java -jar $COMPILER \
--compilation_level SIMPLE_OPTIMIZATIONS \
--hide_warnings_for js/thirdparty \
--js js/license.js \
--js js/thirdparty/ui/jquery-3.3.1.min.js \
--js js/thirdparty/ui/jquery-migrate-3.0.0.min.js \
--js js/thirdparty/ui/jquery.mobile.1.4.5.custom.min.js \
--js js/thirdparty/ui/jquery-qrcode.min.js \
--js js/thirdparty/ui/chart.min.js \
--js js/spear/languages.js \
--js js/spear/index.js \
--js_output_file=${OUT}spear.min.js

# Packing css.
echo "Packing css files..."
cat \
res/css/material.css \
res/css/index.css \
> ${OUT}tmp.css

# Copy to dist.
echo "Copying files to "${OUT}"..."
cp -R -rf res/ ${OUT}
cp -rf flavors/picker.php ${OUT}index.php
cp -rf flavors/pepper.html ${OUT}pepper.html
cp -rf flavors/spear.html ${OUT}spear.html
if [ "$DEBUG" = true ] ; then
    cp -rf js/config_debug.js ${OUT}config.js
    else
    cp -rf js/config_release.js ${OUT}config.js
fi
cp -rf LICENSE ${OUT}

# Compressing css.
echo "Compressing css files..."
java -jar $COMPRESSOR \
--type css \
-o ${OUT}res/css/all.css \
${OUT}tmp.css

#Generate the documentation.
if [ ! -z "$JSDOC" -a "$JSDOC" != " " ]; then
    echo "Generating documentation in "$JSDOC
    jsdoc --recurse --destination $JSDOC --configure jsdoc.conf.json --readme README.md
fi

#cleanup.
echo "Cleaning up..."
rm ${OUT}tmp.css
rm ${OUT}/res/css/material.css
rm ${OUT}/res/css/index.css
echo "Build completed."
