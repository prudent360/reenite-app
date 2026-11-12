<?php

namespace App\Console\Commands;

use App\Blog\WordPressImporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Copies the blog posts from the old WordPress site, images included. Run it before reenite.com moves to the new site,
 * while WordPress still answers. Safe to run again: posts already copied are skipped unless --refresh is given.
 */
#[Signature('blog:import-wordpress {site=https://reenite.com : The WordPress site\'s address} {--refresh : Copy again over posts already imported, replacing edits made here}')]
#[Description('Copy blog posts and their images from a WordPress site')]
class ImportWordPressPosts extends Command
{
    public function handle(WordPressImporter $importer): int
    {
        $site = (string) $this->argument('site');
        $this->components->info("Copying posts from {$site}");

        try {
            $result = $importer->import($site, (bool) $this->option('refresh'));
        } catch (RuntimeException $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }

        foreach ($result['imported'] as $slug) {
            $this->components->twoColumnDetail($slug, '<fg=green>copied</>');
        }
        foreach ($result['skipped'] as $slug) {
            $this->components->twoColumnDetail($slug, '<fg=yellow>already here</>');
        }
        foreach ($result['missing_images'] as $url) {
            $this->components->warn("Couldn't download {$url}");
        }

        $this->newLine();
        $this->components->info(count($result['imported']).' copied, '.count($result['skipped']).' already here. Check them under Admin > Blog.');

        return self::SUCCESS;
    }
}
