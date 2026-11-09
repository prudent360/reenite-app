<?php

namespace Database\Seeders;

use App\Models\Addon;
use App\Models\CancellationPolicy;
use App\Models\Location;
use App\Models\MembershipPlan;
use App\Models\PassPlan;
use App\Models\Space;
use App\Models\SpaceType;
use App\Workspace\OpeningHours;
use Illuminate\Database\Seeder;

/**
 * Reenite Uyo as listed on book.reenite.com (October 2026). Idempotent: existing rows
 * (matched by slug or name) are left as the admin edited them.
 * Add-on and pass prices are placeholders until the real ones are confirmed.
 */
class WorkspaceSeeder extends Seeder
{
    public function run(): void
    {
        $types = collect([
            ['Hot Desk', 'hot-desk', 'armchair', SpaceType::SHARED, 'Flexible seats in the open coworking area.'],
            ['Private Office', 'private-office', 'door-closed', SpaceType::EXCLUSIVE, 'Lockable rooms for individuals and small teams.'],
            ['Meeting Room', 'meeting-room', 'presentation', SpaceType::EXCLUSIVE, 'Rooms for meetings, interviews and presentations.'],
            ['Podcast Studio', 'podcast-studio', 'mic', SpaceType::EXCLUSIVE, 'Sound-treated rooms set up for recording.'],
            ['Event Space', 'event-space', 'party-popper', SpaceType::EXCLUSIVE, 'Halls for workshops, launches and meetups.'],
        ])->mapWithKeys(fn (array $type, int $index) => [$type[1] => SpaceType::firstOrCreate(['slug' => $type[1]], [
            'name' => $type[0], 'icon' => $type[2], 'booking_mode' => $type[3], 'description' => $type[4], 'sort_order' => $index,
        ])]);

        $flexible = CancellationPolicy::firstOrCreate(['name' => 'Flexible'], [
            'description' => 'For desks, offices, meeting rooms and the studio.',
            'rules' => [['hours_before' => 24, 'refund_percent' => 100], ['hours_before' => 0, 'refund_percent' => 0]],
            'is_default' => true,
        ]);
        $events = CancellationPolicy::firstOrCreate(['name' => 'Events'], [
            'description' => 'For the event halls, which are hard to re-let at short notice.',
            'rules' => [['hours_before' => 168, 'refund_percent' => 100], ['hours_before' => 72, 'refund_percent' => 50], ['hours_before' => 0, 'refund_percent' => 0]],
        ]);

        $uyo = Location::firstOrCreate(['slug' => 'reenite-uyo'], [
            'name' => 'Reenite Uyo',
            'address' => '162 Oron Road, Opposite Kilimanjaro',
            'city' => 'Uyo',
            'state' => 'Akwa Ibom State',
            'phone' => '0916 123 1304',
            'description' => 'Our home in Uyo: coworking, private offices, a podcast studio and two event halls.',
            'amenities' => ['High-speed WiFi', 'Steady power', 'Café and refreshments', 'Parking on site', 'Printer', 'Library'],
            'hours' => OpeningHours::defaults(),
        ]);
        foreach ([['Reenite Lekki', 'reenite-lekki', 'Lekki', 'Lagos State'], ['Reenite Victoria Island', 'reenite-victoria-island', 'Victoria Island', 'Lagos State']] as $index => [$name, $slug, $city, $state]) {
            Location::firstOrCreate(['slug' => $slug], [
                'name' => $name, 'address' => 'Coming soon', 'city' => $city, 'state' => $state,
                'description' => 'Coming soon. Hidden from customers until it opens.',
                'hours' => OpeningHours::defaults(), 'is_active' => false, 'sort_order' => $index + 1,
            ]);
        }

        $addons = collect([
            ['Projector and screen', 'For presentations and screenings.', 500_000, 'per_booking', 1],
            ['Extra microphone', 'Wireless handheld or lapel mic.', 200_000, 'per_booking', 4],
            ['Refreshments', 'Tea, coffee, water and snacks for each guest.', 250_000, 'per_person', 200],
        ])->mapWithKeys(fn (array $addon, int $index) => [$addon[0] => Addon::firstOrCreate(['name' => $addon[0]], [
            'description' => $addon[1], 'price' => $addon[2], 'charge_type' => $addon[3], 'max_quantity' => $addon[4], 'sort_order' => $index,
        ])]);

        $spaces = [
            ['Hot Desk', 'hot-desk', 'Flexible seating in our open coworking area.', 40, ['hour' => 120_000, 'day' => 450_000], [], $flexible],
            ['Private Office', 'private-office', 'A quiet, lockable room for you and a colleague.', 2, ['hour' => 200_000], [], $flexible],
            ['Meeting Room', 'meeting-room', 'For meetings, interviews and client presentations, with a TV screen and whiteboard.', 10, ['hour' => 750_000, 'day' => 2_500_000], ['Projector and screen', 'Refreshments'], $flexible],
            ['Podcast Studio', 'podcast-studio', 'A sound-treated room with mics, set up for recording.', 1, ['hour' => 700_000], ['Extra microphone'], $flexible],
            ['Event Hall (30 guests)', 'event-space', 'A hall for workshops and meetups of up to 30 guests.', 30, ['hour' => 3_000_000], ['Projector and screen', 'Extra microphone', 'Refreshments'], $events],
            ['Event Hall (70 guests)', 'event-space', 'Our largest hall, for launches and trainings of up to 70 guests.', 70, ['hour' => 5_000_000], ['Projector and screen', 'Extra microphone', 'Refreshments'], $events],
        ];
        foreach ($spaces as $index => [$name, $type, $summary, $capacity, $rates, $spaceAddons, $policy]) {
            $space = Space::firstOrCreate(['location_id' => $uyo->id, 'name' => $name], [
                'space_type_id' => $types[$type]->id,
                'cancellation_policy_id' => $policy->id,
                'slug' => str($name)->slug()->replace(['-30-guests', '-70-guests'], ['-30', '-70'])->prepend('uyo-')->toString(),
                'summary' => $summary,
                'capacity' => $capacity,
                'min_duration_minutes' => 60,
                'buffer_minutes' => $type === 'event-space' ? 60 : ($type === 'hot-desk' ? 0 : 15),
                'min_notice_minutes' => $type === 'event-space' ? 1440 : 60,
                'advance_booking_days' => $type === 'event-space' ? 365 : 90,
                'sort_order' => $index,
            ]);
            if ($space->wasRecentlyCreated) {
                foreach ($rates as $unit => $price) {
                    $space->rates()->create(['unit' => $unit, 'price' => $price]);
                }
                $space->addons()->sync($addons->only($spaceAddons)->pluck('id'));
            }
        }

        foreach ([['3 days a week', 3, 'week', 1_200_000], ['12 days a month', 12, 'month', 4_500_000]] as $index => [$name, $credits, $period, $price]) {
            $plan = PassPlan::firstOrCreate(['slug' => str($name)->slug()->toString()], [
                'name' => $name, 'location_id' => $uyo->id, 'price' => $price, 'credit_type' => 'visits', 'credits' => $credits, 'period' => $period,
                'description' => "Use a hot desk on any {$credits} days each {$period}.", 'sort_order' => $index,
            ]);
            if ($plan->wasRecentlyCreated) {
                $plan->spaceTypes()->sync([$types['hot-desk']->id]);
            }
        }

        $memberships = [
            ['Basic', 500_000, 10, false, ['10% off every booking', 'Member badge on your profile', 'Email support', 'Early access to new spaces']],
            ['Pro', 1_000_000, 15, true, ['Everything in Basic', '15% off every booking', '1 free guest pass a month', 'Email and WhatsApp support']],
            ['Elite', 2_500_000, 20, false, ['20% off every booking', 'Priority booking', '3 free guest passes a month', '24/7 WhatsApp support']],
        ];
        foreach ($memberships as $index => [$name, $price, $discount, $featured, $perks]) {
            MembershipPlan::firstOrCreate(['slug' => str($name)->slug()->toString()], [
                'name' => $name, 'price' => $price, 'billing_period' => 'month', 'booking_discount_percent' => $discount,
                'is_featured' => $featured, 'perks' => $perks, 'sort_order' => $index,
            ]);
        }
    }
}
