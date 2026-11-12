<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Blog posts, written in Markdown in the admin. A post with no publish date is a draft; one dated in the future
 * goes live by itself at that time.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('excerpt', 500)->nullable();
            $table->longText('body');
            $table->string('cover_path')->nullable();
            $table->string('cover_alt')->nullable();
            $table->string('category', 60)->nullable();
            $table->string('meta_description', 300)->nullable();
            $table->string('author_name', 120)->nullable();
            $table->timestamp('published_at')->nullable()->index();
            $table->unsignedBigInteger('wordpress_id')->nullable()->unique();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
