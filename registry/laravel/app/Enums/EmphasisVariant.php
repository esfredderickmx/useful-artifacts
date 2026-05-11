<?php

namespace App\Enums;

enum EmphasisVariant: string
{
    case AFFIRMATIVE = 'affirmative';
    case INFORMATIVE = 'informative';
    case PREVENTIVE = 'preventive';
    case DESTRUCTIVE = 'destructive';
    case INTERROGATIVE = 'interrogative';
}
