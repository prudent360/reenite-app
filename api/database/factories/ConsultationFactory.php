<?php

namespace Database\Factories;

use App\Models\Consultation;
use App\Models\ConsultationType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Consultation>
 */
class ConsultationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = now()->addDays(3)->setTime(10, 0);

        return [
            'user_id' => User::factory(),
            'consultation_type_id' => ConsultationType::factory(),
            'name' => 'Tax advice',
            'mode' => 'video',
            'starts_at' => $start,
            'ends_at' => $start->copy()->addHour(),
            'topic' => 'How do I register for VAT?',
            'status' => Consultation::CONFIRMED,
            'price' => 1_500_000,
            'confirmed_at' => now(),
        ];
    }
}
