<?php

namespace Tests\Feature\Security;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BackupTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        parent::setUp();

        // No RefreshDatabase: SQLite can't VACUUM inside its transaction. A small table stands in.
        Schema::create('backup_probe', fn (Blueprint $table) => $table->id());

        // Point storage at a throwaway folder so tests never touch real backups or uploads.
        $root = sys_get_temp_dir().'/reenite-backup-test-'.uniqid();
        $this->app->useStoragePath($root);
        File::ensureDirectoryExists("{$root}/app/private/orders");
        File::ensureDirectoryExists("{$root}/app/public/spaces");
        File::put("{$root}/app/private/orders/id.pdf", 'private document');
        File::put("{$root}/app/public/spaces/desk.jpg", 'photo');
        $this->directory = "{$root}/app/private/backups";
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(dirname($this->directory, 3));

        parent::tearDown();
    }

    public function test_it_saves_a_compressed_copy_of_the_database(): void
    {
        $this->artisan('app:backup')->assertSuccessful();

        $files = File::glob("{$this->directory}/database_*.sqlite.gz");
        $this->assertCount(1, $files);
        $this->assertStringStartsWith('SQLite format 3', gzdecode(File::get($files[0])));
    }

    public function test_files_option_zips_uploads_without_old_backups(): void
    {
        File::ensureDirectoryExists($this->directory);
        File::put("{$this->directory}/database_old.sqlite.gz", 'old');

        $this->artisan('app:backup --files')->assertSuccessful();

        $zip = new \ZipArchive;
        $zip->open(File::glob("{$this->directory}/files_*.zip")[0]);
        $names = collect(range(0, $zip->numFiles - 1))->map(fn (int $index) => $zip->getNameIndex($index))->sort()->values()->all();
        $zip->close();

        $this->assertSame(['private/orders/id.pdf', 'public/spaces/desk.jpg'], $names);
    }

    public function test_it_deletes_backups_older_than_the_keep_window(): void
    {
        File::ensureDirectoryExists($this->directory);
        File::put("{$this->directory}/database_old.sqlite.gz", 'old');
        touch("{$this->directory}/database_old.sqlite.gz", now()->subDays(15)->getTimestamp());

        $this->artisan('app:backup --keep=14')->assertSuccessful();

        $this->assertFileDoesNotExist("{$this->directory}/database_old.sqlite.gz");
        $this->assertCount(1, File::glob("{$this->directory}/database_*.sqlite.gz"));
    }

    public function test_queue_worker_is_only_scheduled_when_enabled(): void
    {
        $this->assertFalse($this->scheduledCommands()->contains(fn (string $command) => str_contains($command, 'queue:work')));
        $this->assertTrue($this->scheduledCommands()->contains(fn (string $command) => str_contains($command, 'app:backup')));
    }

    /** @return Collection<int, string> */
    private function scheduledCommands()
    {
        return collect(app(Schedule::class)->events())->map(fn ($event) => (string) $event->command);
    }
}
