<?php

namespace Database\Seeders;

use App\Models\Bundle;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Starter catalogue. ALL PRICES ARE PLACEHOLDERS (including government fees) until Reenite
 * confirms real figures; edit them in Admin > Services. Amounts below are in naira and stored in kobo.
 */
class ServiceCatalogueSeeder extends Seeder
{
    private const ID_DOCUMENT = ['Valid means of ID', 'NIN slip, international passport, driver licence or voter card.'];

    private const PHOTO = ['Passport photograph', 'Recent, clear photo on a plain background.'];

    private const SIGNATURE = ['Signature', 'Sign on white paper, then scan or photograph it.'];

    public function run(): void
    {
        $catalogue = [
            [
                'name' => 'Business Registration', 'icon' => 'building-2',
                'description' => 'CAC registration done properly, from name search to certificate.',
                'services' => [
                    [
                        'name' => 'Business Name Registration', 'fee' => 25_000, 'gov' => 10_000, 'days' => 7,
                        'summary' => 'Register a sole proprietorship or partnership business name with CAC.',
                        'fields' => [
                            ['proposed_name_1', 'First choice business name', 'text', true],
                            ['proposed_name_2', 'Second choice business name', 'text', true, 'help' => 'In case your first choice is not available.'],
                            ['nature_of_business', 'Nature of business', 'select', true, 'options' => ['Trading / retail', 'Professional services', 'Technology', 'Fashion & beauty', 'Food & hospitality', 'Agriculture', 'Other']],
                            ['business_address', 'Business address', 'textarea', true],
                            ['proprietors', 'Proprietors', 'people', true, 'help' => 'Everyone who owns the business.'],
                        ],
                        'docs' => [self::ID_DOCUMENT, self::PHOTO, self::SIGNATURE],
                        'stages' => ['Documents received', 'Name availability search', 'Filed with CAC', 'Certificate issued'],
                    ],
                    [
                        'name' => 'Limited Liability Company (LTD)', 'fee' => 80_000, 'gov' => 25_000, 'days' => 14,
                        'summary' => 'Incorporate a private limited company with directors and shareholders.',
                        'fields' => [
                            ['proposed_name_1', 'First choice company name', 'text', true, 'placeholder' => 'e.g. Ekpo Ventures Ltd'],
                            ['proposed_name_2', 'Second choice company name', 'text', true],
                            ['principal_activity', 'Principal business activity', 'textarea', true],
                            ['registered_address', 'Registered office address', 'textarea', true],
                            ['share_capital', 'Share capital', 'select', true, 'options' => ['₦1,000,000', '₦2,000,000', '₦5,000,000', '₦10,000,000']],
                            ['directors', 'Directors', 'people', true],
                            ['shareholders', 'Shareholders and percentages', 'people', true],
                            ['company_secretary', 'Company secretary (optional)', 'text', false],
                        ],
                        'docs' => [self::ID_DOCUMENT, self::PHOTO, self::SIGNATURE, ['Proof of address', 'Utility bill or bank statement from the last 3 months.']],
                        'stages' => ['Documents received', 'Name reservation', 'Incorporation filed with CAC', 'Certificate and documents issued'],
                        'requires_business' => false,
                    ],
                    [
                        'name' => 'Incorporated Trustees (NGO / Church)', 'fee' => 150_000, 'gov' => 50_000, 'days' => 30,
                        'summary' => 'Register a non-profit, association, foundation or religious body.',
                        'fields' => [
                            ['proposed_name', 'Proposed name', 'text', true],
                            ['aims_objectives', 'Aims and objectives', 'textarea', true],
                            ['address', 'Address of the organisation', 'textarea', true],
                            ['trustees', 'Trustees', 'people', true, 'help' => 'At least two trustees.'],
                        ],
                        'docs' => [self::ID_DOCUMENT, self::PHOTO, ['Constitution', 'Signed constitution of the organisation.'], ['Minutes of meeting', 'Minutes appointing the trustees.']],
                        'stages' => ['Documents received', 'Name reservation', 'Newspaper publication', 'Filed with CAC', 'Certificate issued'],
                    ],
                    [
                        'name' => 'Annual Returns Filing', 'fee' => 20_000, 'gov' => 5_000, 'days' => 5,
                        'summary' => 'Keep your company or business name in good standing with CAC.',
                        'requires_business' => true,
                        'fields' => [
                            ['rc_number', 'RC / BN number', 'text', true],
                            ['years', 'Year(s) to file', 'text', true, 'placeholder' => 'e.g. 2024, 2025'],
                        ],
                        'docs' => [['Certificate of registration', 'Your CAC certificate.']],
                        'stages' => ['Request received', 'Filed with CAC', 'Filing confirmed'],
                    ],
                ],
            ],
            [
                'name' => 'Tax & Compliance', 'icon' => 'calculator',
                'description' => 'TIN, VAT, PAYE and tax clearance handled by our filing team.',
                'services' => [
                    [
                        'name' => 'TIN Registration', 'fee' => 10_000, 'gov' => 0, 'days' => 3,
                        'summary' => 'Get a Tax Identification Number for your business.',
                        'requires_business' => true,
                        'fields' => [['rc_number', 'RC / BN number', 'text', true], ['business_email', 'Business email', 'email', true], ['business_phone', 'Business phone', 'phone', true]],
                        'docs' => [['Certificate of registration', 'Your CAC certificate.'], self::ID_DOCUMENT],
                        'stages' => ['Request received', 'Submitted to tax authority', 'TIN issued'],
                    ],
                    [
                        'name' => 'VAT Registration', 'fee' => 15_000, 'gov' => 0, 'days' => 7,
                        'summary' => 'Register your business for Value Added Tax.',
                        'requires_business' => true,
                        'fields' => [['tin', 'TIN', 'text', true], ['start_date', 'Date business started', 'date', true]],
                        'docs' => [['Certificate of registration', 'Your CAC certificate.']],
                        'stages' => ['Request received', 'Submitted', 'VAT registration confirmed'],
                    ],
                    [
                        'name' => 'Tax Clearance Certificate (TCC)', 'fee' => 50_000, 'gov' => 0, 'days' => 14,
                        'summary' => 'Obtain the TCC you need for tenders, contracts and loans.',
                        'requires_business' => true,
                        'fields' => [['tin', 'TIN', 'text', true], ['years', 'Years covered', 'text', true, 'placeholder' => 'e.g. 2023 to 2025'], ['purpose', 'What is it for?', 'radio', true, 'options' => ['Tender / contract', 'Loan', 'Visa / travel', 'Other']]],
                        'docs' => [['Audited accounts or statement of affairs', 'For each year covered.'], ['Previous tax receipts', 'If you have any.']],
                        'stages' => ['Documents received', 'Tax computation', 'Filed with tax authority', 'TCC issued'],
                    ],
                ],
            ],
            [
                'name' => 'Regulatory', 'icon' => 'shield-check',
                'description' => 'Licences and registrations some businesses need to operate.',
                'services' => [
                    [
                        'name' => 'SCUML Registration', 'fee' => 30_000, 'gov' => 0, 'days' => 14,
                        'summary' => 'Special Control Unit against Money Laundering certificate for designated businesses.',
                        'requires_business' => true,
                        'fields' => [['rc_number', 'RC / BN number', 'text', true], ['sector', 'Business sector', 'text', true]],
                        'docs' => [['Certificate of registration', 'Your CAC certificate.'], self::ID_DOCUMENT],
                        'stages' => ['Documents received', 'Application submitted', 'Certificate issued'],
                    ],
                    [
                        'name' => 'Trademark Registration', 'fee' => 70_000, 'gov' => 30_000, 'days' => 60,
                        'summary' => 'Protect your brand name and logo.',
                        'fields' => [['mark', 'Name or wording of the mark', 'text', true], ['logo', 'Logo (if any)', 'file', false], ['goods_services', 'Goods or services it covers', 'textarea', true]],
                        'docs' => [self::ID_DOCUMENT],
                        'stages' => ['Request received', 'Availability search', 'Application filed', 'Acceptance issued'],
                    ],
                ],
            ],
            [
                'name' => 'Online Presence', 'icon' => 'globe',
                'description' => 'Get found online with a domain, website, email and brand kit.',
                'services' => [
                    [
                        'name' => 'Domain & Business Email', 'fee' => 25_000, 'gov' => 0, 'days' => 2,
                        'summary' => 'A .ng or .com domain with professional email addresses.',
                        'fields' => [['domain_choice', 'Domain you want', 'text', true, 'placeholder' => 'e.g. ekpoventures.com'], ['mailboxes', 'Number of email addresses', 'number', true]],
                        'docs' => [],
                        'stages' => ['Request received', 'Domain registered', 'Email set up'],
                    ],
                    [
                        'name' => 'Starter Business Website', 'fee' => 250_000, 'gov' => 0, 'days' => 14,
                        'summary' => 'A fast, mobile-friendly website of up to 5 pages.',
                        'fields' => [['pages', 'Pages you need', 'textarea', true, 'placeholder' => 'Home, About, Services, Contact...'], ['style', 'Websites you like', 'textarea', false], ['has_domain', 'I already have a domain', 'checkbox', false]],
                        'docs' => [['Logo', 'If you have one.'], ['Photos', 'Pictures of your products, team or premises.']],
                        'stages' => ['Brief received', 'Design', 'Build', 'Review with you', 'Launched'],
                    ],
                    [
                        'name' => 'Logo & Brand Kit', 'fee' => 75_000, 'gov' => 0, 'days' => 7,
                        'summary' => 'Logo, colours, fonts and social media templates.',
                        'fields' => [['business_name', 'Business name', 'text', true], ['description', 'Describe your business and customers', 'textarea', true], ['colours', 'Colour preferences', 'text', false]],
                        'docs' => [],
                        'stages' => ['Brief received', 'First concepts', 'Revisions', 'Final files delivered'],
                    ],
                    [
                        'name' => 'Google Business Profile', 'fee' => 15_000, 'gov' => 0, 'days' => 5,
                        'summary' => 'Show up on Google Maps and Search with reviews and opening hours.',
                        'fields' => [['address', 'Business address', 'textarea', true], ['hours', 'Opening hours', 'text', true]],
                        'docs' => [['Photos', 'Storefront and interior photos.']],
                        'stages' => ['Request received', 'Profile created', 'Verification', 'Live'],
                    ],
                ],
            ],
        ];

        foreach ($catalogue as $categoryOrder => $categoryData) {
            $category = ServiceCategory::updateOrCreate(
                ['slug' => Str::slug($categoryData['name'])],
                ['name' => $categoryData['name'], 'icon' => $categoryData['icon'], 'description' => $categoryData['description'], 'sort_order' => $categoryOrder],
            );

            foreach ($categoryData['services'] as $serviceOrder => $data) {
                $this->seedService($category, $data, $serviceOrder);
            }
        }

        $bundle = Bundle::updateOrCreate(['slug' => 'startup-launch-pack'], [
            'name' => 'Startup Launch Pack',
            'summary' => 'Company registration, TIN, domain and email in one go.',
            'description' => 'Everything a new company needs to be official and reachable, for less than ordering each service separately.',
            'price' => 120_000 * 100,
        ]);
        $slugs = ['limited-liability-company-ltd', 'tin-registration', 'domain-business-email'];
        $ids = Service::whereIn('slug', $slugs)->pluck('id', 'slug');
        $bundle->services()->sync(
            collect($slugs)->values()->mapWithKeys(fn (string $slug, int $position) => [$ids[$slug] => ['sort_order' => $position]])->all()
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function seedService(ServiceCategory $category, array $data, int $order): void
    {
        $service = Service::updateOrCreate(['slug' => Str::slug($data['name'])], [
            'service_category_id' => $category->id,
            'name' => $data['name'],
            'summary' => $data['summary'],
            'description' => $data['summary'],
            'service_fee' => $data['fee'] * 100,
            'government_fee' => $data['gov'] * 100,
            'turnaround_days' => $data['days'],
            'requires_business' => $data['requires_business'] ?? false,
            'sort_order' => $order,
        ]);

        $service->formFields()->delete();
        foreach ($data['fields'] as $position => $field) {
            $service->formFields()->create([
                'key' => $field[0],
                'label' => $field[1],
                'type' => $field[2],
                'is_required' => $field[3],
                'options' => $field['options'] ?? null,
                'placeholder' => $field['placeholder'] ?? null,
                'help_text' => $field['help'] ?? null,
                'sort_order' => $position,
            ]);
        }

        $service->documentRequirements()->delete();
        foreach ($data['docs'] as $position => [$label, $description]) {
            $service->documentRequirements()->create(['label' => $label, 'description' => $description, 'sort_order' => $position]);
        }

        $service->stages()->delete();
        foreach ($data['stages'] as $position => $name) {
            $service->stages()->create(['name' => $name, 'sort_order' => $position]);
        }
    }
}
