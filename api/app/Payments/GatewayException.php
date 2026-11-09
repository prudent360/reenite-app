<?php

namespace App\Payments;

use RuntimeException;

/**
 * A gateway refused or failed a request. The message is safe to show to users.
 */
class GatewayException extends RuntimeException {}
