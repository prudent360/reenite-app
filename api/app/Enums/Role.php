<?php

namespace App\Enums;

enum Role: string
{
    case Customer = 'customer';
    case SuperAdmin = 'super_admin';
    case OperationsManager = 'operations_manager';
    case FilingOfficer = 'filing_officer';
    case FrontDesk = 'front_desk';
    case Finance = 'finance';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::SuperAdmin => 'Super Admin',
            self::OperationsManager => 'Operations Manager',
            self::FilingOfficer => 'Filing Officer',
            self::FrontDesk => 'Front Desk',
            self::Finance => 'Finance',
        };
    }

    public function isStaff(): bool
    {
        return $this !== self::Customer;
    }

    /**
     * Permissions granted to each role. Super Admin bypasses checks via Gate::before.
     *
     * @return list<string>
     */
    public function permissions(): array
    {
        return match ($this) {
            self::Customer, self::SuperAdmin => [],
            self::OperationsManager => [
                'services.manage', 'orders.view_all', 'orders.manage', 'orders.assign',
                'workspace.manage', 'bookings.manage', 'customers.view', 'customers.manage',
                'invoices.manage', 'payments.view', 'reports.view', 'content.manage', 'documents.manage',
                'coupons.manage', 'mail.manage', 'compliance.manage', 'consultations.manage',
            ],
            self::FilingOfficer => ['orders.view_assigned', 'customers.view', 'compliance.manage', 'consultations.view_assigned'],
            self::FrontDesk => ['bookings.manage', 'bookings.checkin', 'customers.view', 'mail.manage'],
            self::Finance => [
                'payments.view', 'payments.verify', 'refunds.process', 'invoices.manage', 'reports.view', 'customers.view',
                'coupons.manage',
            ],
        };
    }

    /**
     * @return list<string>
     */
    public static function allPermissions(): array
    {
        return [
            'settings.manage', 'staff.manage',
            'services.manage', 'content.manage',
            'orders.view_all', 'orders.view_assigned', 'orders.manage', 'orders.assign',
            'workspace.manage', 'bookings.manage', 'bookings.checkin',
            'payments.view', 'payments.verify', 'refunds.process', 'invoices.manage', 'coupons.manage',
            'mail.manage', 'compliance.manage', 'consultations.manage', 'consultations.view_assigned', 'customers.view', 'customers.manage',
            'reports.view', 'documents.manage', 'audit.view',
        ];
    }

    /**
     * @return list<self>
     */
    public static function staffRoles(): array
    {
        return array_values(array_filter(self::cases(), fn (self $role) => $role->isStaff()));
    }
}
