<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;
use ZipArchive;

/**
 * Saves a compressed copy of the database (and, with --files, the uploaded files) to
 * storage/app/private/backups, then deletes copies older than --keep days.
 * Hostinger's own daily backups are the second copy; download one now and then for a third.
 */
#[Signature('app:backup {--files : Also zip uploaded documents and photos} {--keep=14 : Days of backups to keep}')]
#[Description('Back up the database and, optionally, uploaded files')]
class BackupApp extends Command
{
    public function handle(): int
    {
        $directory = storage_path('app/private/backups');
        File::ensureDirectoryExists($directory);
        $stamp = now()->format('Y-m-d_His');

        try {
            $database = $this->backupDatabase($directory, $stamp);
            $this->info('Database saved to '.basename($database));

            if ($this->option('files')) {
                $files = $this->backupFiles($directory, $stamp);
                $this->info('Files saved to '.basename($files));
            }
        } catch (RuntimeException $exception) {
            $this->error('Backup failed: '.$exception->getMessage());
            report($exception);

            return self::FAILURE;
        }

        $removed = $this->prune($directory, max(1, (int) $this->option('keep')));
        if ($removed > 0) {
            $this->line("Removed {$removed} old backup(s).");
        }

        return self::SUCCESS;
    }

    private function backupDatabase(string $directory, string $stamp): string
    {
        $connection = config('database.default');
        $config = config("database.connections.{$connection}");
        $raw = "{$directory}/database_{$stamp}.".($config['driver'] === 'sqlite' ? 'sqlite' : 'sql');

        match ($config['driver']) {
            'sqlite' => DB::connection($connection)->statement('VACUUM INTO ?', [$raw]),
            'mysql', 'mariadb' => $this->mysqlDump($config, $raw),
            default => throw new RuntimeException("Backups are not set up for the {$config['driver']} driver."),
        };

        return $this->gzip($raw);
    }

    /** @param  array<string, mixed>  $config */
    private function mysqlDump(array $config, string $path): void
    {
        $result = Process::env(['MYSQL_PWD' => (string) ($config['password'] ?? '')])
            ->timeout(600)
            ->run([
                'mysqldump', '--single-transaction', '--quick', '--no-tablespaces', '--routines',
                '--host='.$config['host'], '--port='.$config['port'], '--user='.$config['username'],
                '--result-file='.$path, $config['database'],
            ]);

        if (! $result->successful()) {
            File::delete($path);
            throw new RuntimeException(trim($result->errorOutput()) ?: 'mysqldump failed.');
        }
    }

    /** Compresses in chunks so a large dump never has to fit in memory. */
    private function gzip(string $path): string
    {
        $target = $path.'.gz';
        $in = fopen($path, 'rb');
        $out = gzopen($target, 'wb6');
        if ($in === false || $out === false) {
            throw new RuntimeException('Could not write the compressed backup.');
        }
        while (! feof($in)) {
            gzwrite($out, (string) fread($in, 1024 * 512));
        }
        fclose($in);
        gzclose($out);
        File::delete($path);

        return $target;
    }

    private function backupFiles(string $directory, string $stamp): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('The PHP zip extension is needed to back up files.');
        }

        $target = "{$directory}/files_{$stamp}.zip";
        $zip = new ZipArchive;
        if ($zip->open($target, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not create the files archive.');
        }

        foreach (['private' => storage_path('app/private'), 'public' => storage_path('app/public')] as $label => $root) {
            if (! is_dir($root)) {
                continue;
            }
            foreach (File::allFiles($root) as $file) {
                if (str_starts_with($file->getPathname(), $directory)) {
                    continue; // never put old backups inside a new one
                }
                $zip->addFile($file->getPathname(), $label.'/'.$file->getRelativePathname());
            }
        }
        $zip->close();

        return $target;
    }

    private function prune(string $directory, int $keepDays): int
    {
        $cutoff = now()->subDays($keepDays)->getTimestamp();
        $removed = 0;
        foreach (File::files($directory) as $file) {
            if ($file->getMTime() < $cutoff) {
                File::delete($file->getPathname());
                $removed++;
            }
        }

        return $removed;
    }
}
