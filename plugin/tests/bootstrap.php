<?php
/**
 * PHPUnit bootstrap file
 *
 * @package recipe-pro
 */

$_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( ! $_tests_dir ) {
	$_tests_dir = '/tmp/wordpress-tests-lib';
}

function var_log() {
    ob_start();
    call_user_func_array( 'var_dump', func_get_args() );
    error_log( ob_get_clean() );
}

// Give access to tests_add_filter() function.
require_once $_tests_dir . '/includes/functions.php';
// require_once( dirname( dirname( __FILE__ ) ) . 'wp-admin/includes/plugin.php' )
// activate_plugin( dirname( dirname( __FILE__ ) ) . '/recipe-pro.php' );
/**
 * Manually load the plugin being tested.
 */
function _manually_load_plugin() {
	require dirname( dirname( __FILE__ ) ) . '/recipe-pro.php';
}
tests_add_filter( 'muplugins_loaded', '_manually_load_plugin' );

// Start up the WP testing environment.
require $_tests_dir . '/includes/bootstrap.php';
