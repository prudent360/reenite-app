<?php

namespace Database\Factories;

use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Post>
 */
class PostFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = 'Working better in Uyo '.Str::lower(Str::random(5));

        return [
            'title' => $title,
            'slug' => Str::slug($title),
            'excerpt' => 'A few ideas for getting more done this week.',
            'body' => "## Start early\n\nThe first hour sets the tone for the day.\n\n- Plan three things\n- Turn off notifications",
            'category' => 'Productivity',
            'author_name' => 'Reenite',
            'published_at' => now()->subDay(),
        ];
    }

    public function draft(): static
    {
        return $this->state(['published_at' => null]);
    }

    public function scheduled(): static
    {
        return $this->state(['published_at' => now()->addWeek()]);
    }
}
