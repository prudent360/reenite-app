<?php

namespace Database\Factories;

use App\Models\ConsultationType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ConsultationType>
 */
class ConsultationTypeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = 'Tax advice '.Str::lower(Str::random(4));

        return [
            'name' => $name,
            'slug' => Str::slug($name),
            'description' => 'Talk through your tax questions with an officer.',
            'duration_minutes' => 60,
            'price' => 1_500_000,
            'mode' => 'video',
            // Monday to Friday, 9am to 5pm Lagos time.
            'schedule' => ['1' => ['09:00', '17:00'], '2' => ['09:00', '17:00'], '3' => ['09:00', '17:00'], '4' => ['09:00', '17:00'], '5' => ['09:00', '17:00']],
            'notice_hours' => 12,
            'is_active' => true,
        ];
    }
}
