<?php

namespace App\Enums;

/**
 * Field types available in the service intake-form builder.
 */
enum FieldType: string
{
    case Text = 'text';
    case Textarea = 'textarea';
    case Number = 'number';
    case Email = 'email';
    case Phone = 'phone';
    case Date = 'date';
    case Select = 'select';
    case Radio = 'radio';
    case Checkbox = 'checkbox';
    case File = 'file';
    case People = 'people';

    public function label(): string
    {
        return match ($this) {
            self::Text => 'Short text',
            self::Textarea => 'Long text',
            self::Number => 'Number',
            self::Email => 'Email',
            self::Phone => 'Phone',
            self::Date => 'Date',
            self::Select => 'Dropdown',
            self::Radio => 'Multiple choice',
            self::Checkbox => 'Yes / no',
            self::File => 'File upload',
            self::People => 'People (directors, shareholders...)',
        };
    }

    /**
     * Dropdowns and multiple choice need a list of options.
     */
    public function needsOptions(): bool
    {
        return in_array($this, [self::Select, self::Radio], true);
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $type) => $type->value, self::cases());
    }
}
