<?php

namespace Database\Seeders;

use App\Models\ConsultationType;
use Illuminate\Database\Seeder;

/**
 * Starter consultations with placeholder prices. Admins change them under Admin > Consultations.
 */
class ConsultationTypeSeeder extends Seeder
{
    public function run(): void
    {
        $weekdays = ['1' => ['09:00', '16:00'], '2' => ['09:00', '16:00'], '3' => ['09:00', '16:00'], '4' => ['09:00', '16:00'], '5' => ['09:00', '16:00']];

        $types = [
            ['slug' => 'business-registration-advice', 'name' => 'Business registration advice', 'description' => 'Not sure whether you need a Business Name or a limited company? Talk it through with a legal officer before you register.', 'duration_minutes' => 30, 'price' => 1_000_000, 'mode' => 'video', 'sort_order' => 1],
            ['slug' => 'tax-and-compliance-review', 'name' => 'Tax and compliance review', 'description' => 'A tax officer reviews your TIN, VAT, PAYE and annual returns, and tells you exactly what is due and when.', 'duration_minutes' => 60, 'price' => 2_500_000, 'mode' => 'video', 'sort_order' => 2],
            ['slug' => 'in-person-business-clinic', 'name' => 'In-person business clinic', 'description' => 'Bring your documents to our office and sort out registration, tax or compliance questions face to face.', 'duration_minutes' => 60, 'price' => 3_000_000, 'mode' => 'in_person', 'sort_order' => 3],
        ];

        foreach ($types as $type) {
            ConsultationType::firstOrCreate(['slug' => $type['slug']], $type + ['schedule' => $weekdays, 'notice_hours' => 12, 'is_active' => true]);
        }
    }
}
