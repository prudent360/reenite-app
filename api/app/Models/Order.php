<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id', 'service_id', 'invoice_id', 'assigned_to', 'status', 'service_name', 'form_snapshot',
    'requirements_snapshot', 'stages_snapshot', 'answers', 'current_stage', 'paid_at', 'started_at',
    'due_at', 'completed_at', 'cancelled_at', 'cancel_reason',
])]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'form_snapshot' => 'array',
            'requirements_snapshot' => 'array',
            'stages_snapshot' => 'array',
            'answers' => 'array',
            'current_stage' => 'integer',
            'paid_at' => 'datetime',
            'started_at' => 'datetime',
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * References follow the id: RN-2026-000123.
     */
    protected static function booted(): void
    {
        static::created(function (Order $order) {
            $order->forceFill(['reference' => sprintf('RN-%s-%06d', $order->created_at->format('Y'), $order->id)])->saveQuietly();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    public function isOverdue(): bool
    {
        return $this->status->isActive() && $this->due_at !== null && $this->due_at->isPast();
    }

    /**
     * Staff who may work on this order: anyone who can see all orders, or the assigned officer.
     */
    public function isWorkableBy(User $user): bool
    {
        return $user->can('orders.view_all') || ($user->can('orders.view_assigned') && $this->assigned_to === $user->id);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Service, $this>
     */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /**
     * @return HasMany<OrderFile, $this>
     */
    public function files(): HasMany
    {
        return $this->hasMany(OrderFile::class)->latest('id');
    }

    /**
     * @return HasMany<OrderEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(OrderEvent::class)->latest('id');
    }

    /**
     * @return HasMany<OrderMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(OrderMessage::class)->oldest('id');
    }
}
