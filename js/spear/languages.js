/**
 * @overview Litemint Spear resources languages implementation.
 * @copyright 2018-2019 Frederic Rezeau.
 * @copyright 2018-2019 Litemint LLC.
 * @license [MIT]{@link https://github.com/litemint/litemint/blob/master/LICENSE}
 */

(function (namespace) {
    "use strict";

    namespace.Spear = namespace.Spear || {};

    /**
     * Language pack for English.
     * @member englishLanguagePack
     * @memberof Litemint.Spear
    */
    const englishLanguagePack = [
        "Sign Out",
        "Enter your public key, secret key or 24-word phrase.",
        "Enter a valid account.",
        "Account",
        "Sign In",
        "or create a new account",
        "Security",
        "Your account keys are never sent to our servers. Keep a safe backup of your keys. All your personal data are deleted when you logout or close this window.",
        "Assets",
        "Activity",
        "Account",
        "Send",
        "Receive",
        "Trade",
        "Balance",
        "Add Asset",
        "Remove Asset",
        "Verified"
    ];

    /**
     * Language pack for French.
     * @member frenchLanguagePack
     * @memberof Litemint.Spear
    */
    const frenchLanguagePack = [
        "Déconnexion",
        "Entrez votre clé publique, votre clé secrète ou votre phrase de 24 mots.",
        "Entrez un compte valide.",
        "Compte",
        "Se connecter",
        "ou créer un nouveau compte",
        "Sécurité",
        "Vos clés de compte ne sont jamais envoyées à nos serveurs. Conservez une copie de sauvegarde de vos clés. Toutes vos données personnelles sont supprimées lorsque vous vous déconnectez ou fermez cette fenêtre.",
        "Avoirs",
        "Activité",
        "Compte",
        "Envoyer",
        "Recevoir",
        "Echanger",
        "Balance",
        "Ajouter un Avoir",
        "Supprimer un Avoir",
        "Verifié"
    ];

    /**
     * Language pack for Korean.
     * @member koreanLanguagePack
     * @memberof Litemint.Spear
    */
    const koreanLanguagePack = [
        "로그 아웃",
        "공개 키, 비밀 키 또는 24 단어 구문을 입력하십시오.",
        "유효한 계정을 입력하십시오.",
        "계정",
        "로그인",
        "또는 새 계정 만들기",
        "보안",
        "귀하의 계정 키는 서버로 전송되지 않습니다. 귀하의 키를 안전하게 보관하십시오. 로그 아웃하거나 창을 닫으면 모든 개인 데이터가 삭제됩니다.",
        "자산",
        "활동",
        "계정",
        "보내다",
        "받다",
        "무역",
        "균형",
        "자산 추가",
        "자산 삭제",
        "확인 된"
    ];

    /**
     * List of language packs.
     * @member languagePacks
     * @memberof Litemint.Spear
    */
    namespace.Spear.languagePacks = {
        "en": { "name": "English", "text": englishLanguagePack },
        "fr": { "name": "Français", "text": frenchLanguagePack },
        "kr": { "name": "한국어", "text": koreanLanguagePack }
    };

    /**
     * Default Spear default language.
     * @member defaultLanguage
     * @memberof Litemint.Spear
    */
    namespace.Spear.defaultLanguage = "en";

})(window.Litemint = window.Litemint || {});
