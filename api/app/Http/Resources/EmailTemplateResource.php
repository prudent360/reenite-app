<?php

namespace App\Http\Resources;

use App\Models\EmailTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin EmailTemplate
 */
class EmailTemplateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $defaults = $this->key->defaults();

        return [
            'key' => $this->key->value,
            'name' => $this->key->name(),
            'description' => $this->key->description(),
            'group' => $this->key->group(),
            'is_essential' => $this->key->isEssential(),
            'placeholders' => collect($this->key->placeholders())->map(fn (string $label, string $name) => ['name' => $name, 'label' => $label])->values(),
            'is_enabled' => $this->is_enabled,
            'subject' => $this->subject,
            'heading' => $this->heading,
            'body' => $this->body,
            'button_text' => $this->button_text,
            'footer' => $this->footer,
            'is_customised' => collect($defaults)->contains(fn ($value, string $field) => $this->{$field} !== $value),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
