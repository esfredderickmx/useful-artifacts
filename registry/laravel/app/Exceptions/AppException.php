<?php

namespace App\Exceptions;

use App\Enums\EmphasisVariant;
use App\Enums\FlashResponse;
use Exception;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

use function back;

class AppException extends Exception
{
    public function __construct(string $message, protected FlashResponse $style = FlashResponse::CALLOUT, protected EmphasisVariant $variant = EmphasisVariant::AFFIRMATIVE)
    {
        parent::__construct($message, 400);
    }

    public function render(Request $request): RedirectResponse
    {
        Inertia::notify($this->message, $this->style, $this->variant);

        return back();
    }
}
