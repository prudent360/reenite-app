<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\CustomerImportedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

use function Illuminate\Support\defer;

/**
 * Adds customers from a spreadsheet (CSV) exported from another system. Everyone imported gets the
 * same temporary password and has to choose their own the first time they sign in.
 *
 * Send `preview` first to see what will happen to each row without saving anything.
 * Existing accounts are never changed, except guests (people who booked without an account),
 * who become full accounts and keep their bookings.
 */
class CustomerImportController extends Controller
{
    public const MAX_ROWS = 2000;

    public const NEW = 'new';

    public const GUEST = 'guest';

    public const EXISTS = 'exists';

    public const INVALID = 'invalid';

    /** Header names we recognise, after lowercasing and stripping anything that isn't a letter. */
    private const HEADERS = [
        'name' => ['name', 'fullname', 'customername', 'clientname', 'displayname', 'customer', 'client'],
        'first_name' => ['firstname', 'givenname', 'forename'],
        'last_name' => ['lastname', 'surname', 'familyname'],
        'email' => ['email', 'emailaddress', 'mail', 'customeremail'],
        'phone' => ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'telephone', 'tel', 'whatsapp', 'whatsappnumber', 'contactnumber', 'phoneno'],
    ];

    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:3072'],
            'preview' => ['sometimes', 'boolean'],
            'temporary_password' => ['exclude_if:preview,true', 'exclude_if:preview,1', 'required', 'string', 'max:72', Password::defaults()],
            'send_email' => ['sometimes', 'boolean'],
        ], ['file.mimes' => 'Upload a CSV file. In Excel or Google Sheets, use File, Save as (or Download), CSV.']);

        $rows = $this->plan($this->read($validated['file']));
        $summary = $this->summarise($rows);

        if ($request->boolean('preview')) {
            return response()->json(['summary' => $summary, 'rows' => $rows]);
        }

        $imported = $this->import($rows, $validated['temporary_password']);

        if ($request->boolean('send_email') && $imported->isNotEmpty()) {
            $notification = new CustomerImportedNotification($validated['temporary_password']);
            // Hundreds of emails can take a while, so they go out after the response.
            defer(fn () => Notification::send($imported, $notification));
        }

        $count = $imported->count();
        $message = ($count === 1 ? '1 customer' : "{$count} customers").' imported.';
        if ($count > 0) {
            $message .= $request->boolean('send_email') ? ' Their sign-in details are on the way by email.' : ' Remember to tell them their temporary password.';
        }
        $skipped = $summary[self::EXISTS] + $summary[self::INVALID];
        if ($skipped > 0) {
            $message .= ' '.($skipped === 1 ? '1 row was' : "{$skipped} rows were").' skipped.';
        }

        return response()->json(['summary' => $summary, 'imported' => $count, 'message' => $message]);
    }

    /**
     * The file's rows as name, email and phone, matched by header names.
     *
     * @return list<array{row: int, name: string, email: string, phone: string}>
     */
    private function read(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath(), 'r');
        $first = (string) fgets($handle);
        rewind($handle);

        // Excel in some regions saves with semicolons.
        $delimiter = substr_count($first, ';') > substr_count($first, ',') ? ';' : ',';
        $header = fgetcsv($handle, null, $delimiter, '"', '');
        $columns = $this->columns($header === false ? [] : $header);

        if (! isset($columns['email'])) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'We couldn\'t find an email column. The first row must have headings, for example: Name, Email, Phone.']);
        }

        $rows = [];
        $line = 1;
        while (($cells = fgetcsv($handle, null, $delimiter, '"', '')) !== false) {
            $line++;
            $cell = fn (string $key): string => isset($columns[$key]) ? Str::squish((string) ($cells[$columns[$key]] ?? '')) : '';
            $name = $cell('name') ?: trim($cell('first_name').' '.$cell('last_name'));

            if ($name === '' && $cell('email') === '' && $cell('phone') === '') {
                continue;
            }
            if (count($rows) === self::MAX_ROWS) {
                fclose($handle);
                throw ValidationException::withMessages(['file' => 'That file has more than '.self::MAX_ROWS.' customers. Split it into smaller files and import them one at a time.']);
            }

            $rows[] = ['row' => $line, 'name' => $name, 'email' => mb_strtolower($cell('email')), 'phone' => $cell('phone')];
        }
        fclose($handle);

        if ($rows === []) {
            throw ValidationException::withMessages(['file' => 'That file has headings but no customers under them.']);
        }

        return $rows;
    }

    /**
     * @param  list<string|null>  $header
     * @return array<string, int> field => column index
     */
    private function columns(array $header): array
    {
        $columns = [];
        foreach ($header as $index => $heading) {
            // Strip a byte-order mark and anything that isn't a letter: "E-mail Address" becomes "emailaddress".
            $key = preg_replace('/[^a-z]/', '', mb_strtolower(str_replace("\u{FEFF}", '', (string) $heading)));
            foreach (self::HEADERS as $field => $names) {
                if (! isset($columns[$field]) && in_array($key, $names, true)) {
                    $columns[$field] = $index;
                }
            }
        }

        return $columns;
    }

    /**
     * What will happen to each row, with a note on anything we had to change or skip.
     *
     * @param  list<array{row: int, name: string, email: string, phone: string}>  $rows
     * @return list<array{row: int, name: string, email: string, phone: string, result: string, note: string|null}>
     */
    private function plan(array $rows): array
    {
        $existing = User::query()->whereIn('email', array_column($rows, 'email'))->get(['id', 'email', 'status'])->keyBy('email');
        $takenPhones = User::query()->whereIn('phone', array_filter(array_column($rows, 'phone')))->pluck('email', 'phone');
        $seenEmails = [];
        $seenPhones = [];

        return array_map(function (array $row) use ($existing, $takenPhones, &$seenEmails, &$seenPhones): array {
            $notes = [];
            $result = self::NEW;

            if ($row['email'] === '' || filter_var($row['email'], FILTER_VALIDATE_EMAIL) === false || mb_strlen($row['email']) > 255) {
                return $row + ['result' => self::INVALID, 'note' => $row['email'] === '' ? 'No email address.' : 'The email address isn\'t valid.'];
            }
            if (isset($seenEmails[$row['email']])) {
                return $row + ['result' => self::INVALID, 'note' => "Same email as row {$seenEmails[$row['email']]}."];
            }
            $seenEmails[$row['email']] = $row['row'];

            $account = $existing->get($row['email']);
            if ($account && ! $account->isGuest()) {
                return $row + ['result' => self::EXISTS, 'note' => 'Already has an account, left as it is.'];
            }
            if ($account) {
                $result = self::GUEST;
                $notes[] = 'Booked before as a guest. Their bookings stay with the account.';
            }

            if ($row['name'] === '') {
                $row['name'] = Str::headline(Str::before($row['email'], '@'));
                $notes[] = 'No name, so we used the start of the email.';
            }
            $row['name'] = Str::limit($row['name'], 120, '');

            if ($row['phone'] !== '') {
                $owner = $takenPhones->get($row['phone']);
                $problem = match (true) {
                    preg_match('/^\+?[0-9\s-]{7,20}$/', $row['phone']) !== 1 => 'isn\'t a valid number',
                    $owner !== null && $owner !== $row['email'] => 'belongs to another account',
                    isset($seenPhones[$row['phone']]) => "is also on row {$seenPhones[$row['phone']]}",
                    default => null,
                };
                if ($problem !== null) {
                    $notes[] = "Phone {$row['phone']} {$problem}, so it was left off.";
                    $row['phone'] = '';
                } else {
                    $seenPhones[$row['phone']] = $row['row'];
                }
            }

            return $row + ['result' => $result, 'note' => $notes === [] ? null : implode(' ', $notes)];
        }, $rows);
    }

    /**
     * @param  list<array{result: string}>  $rows
     * @return array{total: int, new: int, guest: int, exists: int, invalid: int}
     */
    private function summarise(array $rows): array
    {
        $counts = array_count_values(array_column($rows, 'result'));

        return ['total' => count($rows)] + array_map(fn (string $result) => $counts[$result] ?? 0, [
            self::NEW => self::NEW, self::GUEST => self::GUEST, self::EXISTS => self::EXISTS, self::INVALID => self::INVALID,
        ]);
    }

    /**
     * Creates the accounts. The password is hashed once and shared, which keeps big files quick.
     *
     * @param  list<array{row: int, name: string, email: string, phone: string, result: string, note: string|null}>  $rows
     * @return Collection<int, User>
     */
    private function import(array $rows, string $temporaryPassword): Collection
    {
        $hash = Hash::make($temporaryPassword);
        $guests = User::query()->where('status', User::STATUS_GUEST)
            ->whereIn('email', array_column(array_filter($rows, fn (array $row) => $row['result'] === self::GUEST), 'email'))
            ->get()->keyBy('email');

        return DB::transaction(function () use ($rows, $hash, $guests) {
            $imported = collect();

            foreach ($rows as $row) {
                if (! in_array($row['result'], [self::NEW, self::GUEST], true)) {
                    continue;
                }

                $user = $guests->get($row['email']) ?? new User(['email' => $row['email'], 'type' => User::TYPE_CUSTOMER]);
                $user->forceFill([
                    'name' => $row['name'],
                    'phone' => $row['phone'] !== '' ? $row['phone'] : $user->phone,
                    'password' => $hash,
                    'status' => User::STATUS_ACTIVE,
                    'must_change_password' => true,
                    // They were customers of the business already, so staff vouch for the address.
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ])->save();

                if (! $user->hasRole(Role::Customer->value)) {
                    $user->assignRole(Role::Customer->value);
                }
                $imported->push($user);
            }

            return $imported;
        });
    }
}
