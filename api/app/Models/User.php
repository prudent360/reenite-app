<?php

namespace App\Models;

use App\Enums\Role;
use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailNotification;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'phone', 'password', 'type', 'status'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    public const TYPE_CUSTOMER = 'customer';

    public const TYPE_STAFF = 'staff';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_SUSPENDED = 'suspended';

    /**
     * Created when someone books without an account. They can't sign in until they register
     * with the same email, which turns this into an active account and keeps their bookings.
     */
    public const STATUS_GUEST = 'guest';

    // Roles are defined on the web guard; Sanctum-authenticated requests check against it too.
    protected string $guard_name = 'web';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isStaff(): bool
    {
        return $this->type === self::TYPE_STAFF;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isGuest(): bool
    {
        return $this->status === self::STATUS_GUEST;
    }

    /**
     * The membership whose discount applies right now, if any.
     */
    public function activeMembership(): ?CustomerMembership
    {
        return $this->memberships()
            ->where('status', CustomerMembership::ACTIVE)
            ->where('starts_at', '<=', now())
            ->where('ends_at', '>', now())
            ->orderByDesc('discount_percent')
            ->first();
    }

    /**
     * Uses the admin-editable "Verify email" template.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification);
    }

    /**
     * Uses the admin-editable "Password reset" template.
     *
     * @param  string  $token
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * @return HasMany<Booking, $this>
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /**
     * @return HasMany<CustomerPass, $this>
     */
    public function passes(): HasMany
    {
        return $this->hasMany(CustomerPass::class);
    }

    /**
     * @return HasMany<CustomerMembership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(CustomerMembership::class);
    }

    /**
     * @return HasMany<DocumentSignature, $this>
     */
    public function documentSignatures(): HasMany
    {
        return $this->hasMany(DocumentSignature::class);
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(Role::SuperAdmin->value);
    }
}
