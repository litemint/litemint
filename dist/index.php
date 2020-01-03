<?php
    /*
        License MIT.
        copyright 2018 Frederic Rezeau, Litemint LLC.
    */

    /* Let's cook */
    $flavor = 'spear';
    if (isset($_GET['flavor'])) {
        $flavor = $_GET['flavor'];
    }
    switch ($flavor) {
        case 'pepper':
        case 'spear':
            include $flavor.'.html';
            break;
        default:
            echo 'litemint + '.$flavor.' = unknown recipe';
    }
?>
