<?php

use App\Http\Controllers\Api\V1\Admin\ActivityLogController;
use App\Http\Controllers\Api\V1\Admin\AppointmentController as AdminAppointmentController;
use App\Http\Controllers\Api\V1\Admin\BlogPostController;
use App\Http\Controllers\Api\V1\Admin\BookingController as AdminBookingController;
use App\Http\Controllers\Api\V1\Admin\BundleController;
use App\Http\Controllers\Api\V1\Admin\ComplianceController as AdminComplianceController;
use App\Http\Controllers\Api\V1\Admin\ConsultationController as AdminConsultationController;
use App\Http\Controllers\Api\V1\Admin\ConsultationTypeController;
use App\Http\Controllers\Api\V1\Admin\DashboardController;
use App\Http\Controllers\Api\V1\Admin\Finance\CouponController;
use App\Http\Controllers\Api\V1\Admin\Finance\InvoiceController as AdminInvoiceController;
use App\Http\Controllers\Api\V1\Admin\Finance\PaymentController as AdminPaymentController;
use App\Http\Controllers\Api\V1\Admin\Finance\RenewalController;
use App\Http\Controllers\Api\V1\Admin\Finance\SummaryController as FinanceSummaryController;
use App\Http\Controllers\Api\V1\Admin\LegalDocumentController;
use App\Http\Controllers\Api\V1\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Api\V1\Admin\ReportController;
use App\Http\Controllers\Api\V1\Admin\ServiceBuilderController;
use App\Http\Controllers\Api\V1\Admin\ServiceCategoryController;
use App\Http\Controllers\Api\V1\Admin\ServiceController;
use App\Http\Controllers\Api\V1\Admin\Settings\BankAccountController;
use App\Http\Controllers\Api\V1\Admin\Settings\EmailTemplateController;
use App\Http\Controllers\Api\V1\Admin\Settings\MailSettingsController;
use App\Http\Controllers\Api\V1\Admin\Settings\PaymentSettingsController;
use App\Http\Controllers\Api\V1\Admin\Settings\SignatoryController;
use App\Http\Controllers\Api\V1\Admin\Settings\WhatsAppSettingsController;
use App\Http\Controllers\Api\V1\Admin\Settings\WorkspaceSettingsController;
use App\Http\Controllers\Api\V1\Admin\StaffController;
use App\Http\Controllers\Api\V1\Admin\UserController;
use App\Http\Controllers\Api\V1\Admin\Workspace\AddonController;
use App\Http\Controllers\Api\V1\Admin\Workspace\BlackoutDateController;
use App\Http\Controllers\Api\V1\Admin\Workspace\CancellationPolicyController;
use App\Http\Controllers\Api\V1\Admin\Workspace\LocationController;
use App\Http\Controllers\Api\V1\Admin\Workspace\MailboxController as AdminMailboxController;
use App\Http\Controllers\Api\V1\Admin\Workspace\MembershipPlanController;
use App\Http\Controllers\Api\V1\Admin\Workspace\PassPlanController;
use App\Http\Controllers\Api\V1\Admin\Workspace\SpaceController;
use App\Http\Controllers\Api\V1\Admin\Workspace\SpaceSeatController;
use App\Http\Controllers\Api\V1\Admin\Workspace\SpaceTypeController;
use App\Http\Controllers\Api\V1\AgreementController;
use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\EmailVerificationController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Billing\BillingController;
use App\Http\Controllers\Api\V1\Billing\PaymentMethodController;
use App\Http\Controllers\Api\V1\BlogController;
use App\Http\Controllers\Api\V1\BookingController;
use App\Http\Controllers\Api\V1\BusinessController;
use App\Http\Controllers\Api\V1\CatalogueController;
use App\Http\Controllers\Api\V1\ComplianceController;
use App\Http\Controllers\Api\V1\ConsultationController;
use App\Http\Controllers\Api\V1\MailboxController;
use App\Http\Controllers\Api\V1\MetaController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PlanController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\UploadGrantController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Controllers\Api\V1\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('v1.')->group(function () {
    Route::get('catalogue', [CatalogueController::class, 'index'])->name('catalogue.index');
    Route::get('catalogue/services/{slug}', [CatalogueController::class, 'show'])->name('catalogue.services.show');
    Route::get('blog', [BlogController::class, 'index'])->name('blog.index');
    Route::get('blog/{slug}', [BlogController::class, 'show'])->name('blog.show');
    Route::get('workspace', [WorkspaceController::class, 'index'])->name('workspace.index');
    Route::get('workspace/spaces/{slug}', [WorkspaceController::class, 'space'])->name('workspace.spaces.show');
    Route::get('workspace/booking-settings', [WorkspaceController::class, 'bookingSettings'])->name('workspace.booking-settings');
    Route::get('workspace/spaces/{slug}/availability', [WorkspaceController::class, 'availability'])->middleware('throttle:60,1')->name('workspace.spaces.availability');
    Route::get('workspace/spaces/{slug}/seats', [WorkspaceController::class, 'seats'])->middleware('throttle:60,1')->name('workspace.spaces.seats');

    // Booking works for guests too: a guest proves it's their booking with its private token.
    Route::prefix('bookings')->name('bookings.')->group(function () {
        Route::post('quote', [BookingController::class, 'quote'])->middleware('throttle:60,1')->name('quote');
        // The same methods the billing pages offer; guests paying for a booking need them too.
        Route::get('payment-options', [BillingController::class, 'options'])->name('payment-options');
        Route::post('/', [BookingController::class, 'store'])->middleware('throttle:10,1')->name('store');
        Route::get('{booking}', [BookingController::class, 'show'])->middleware('throttle:60,1')->name('show');
        Route::post('{booking}/cancel', [BookingController::class, 'cancel'])->middleware('throttle:10,1')->name('cancel');
        Route::post('{booking}/coupon', [BookingController::class, 'applyCoupon'])->middleware('throttle:10,1')->name('coupon.store');
        Route::delete('{booking}/coupon', [BookingController::class, 'removeCoupon'])->middleware('throttle:10,1')->name('coupon.destroy');
        Route::post('{booking}/pay', [BookingController::class, 'pay'])->middleware('throttle:10,1')->name('pay');
        Route::post('{booking}/bank-transfer', [BookingController::class, 'bankTransfer'])->middleware('throttle:5,1')->name('bank-transfer');
        Route::post('{booking}/payments/{payment:reference}/verify', [BookingController::class, 'verifyPayment'])->middleware('throttle:20,1')->withoutScopedBindings()->name('payments.verify');
    });

    Route::get('consultations/types', [ConsultationController::class, 'types'])->name('consultations.types');
    Route::get('consultations/types/{type}/slots', [ConsultationController::class, 'slots'])->middleware('throttle:60,1')->name('consultations.slots');

    // Appointments staff booked: clients open them from the private link in their messages.
    Route::get('appointments/{appointment}', [AppointmentController::class, 'show'])->middleware('throttle:30,1')->name('appointments.show');
    Route::post('appointments/{appointment}/respond', [AppointmentController::class, 'respond'])->middleware('throttle:10,1')->name('appointments.respond');

    // The website asks for a link so the browser can send a file straight here (not via Vercel).
    Route::post('upload-grants', [UploadGrantController::class, 'store'])->middleware('throttle:30,1')->name('upload-grants.store');

    // Gateway notifications: authenticated by signature, not by session.
    Route::post('webhooks/{gateway}', WebhookController::class)->name('webhooks');

    Route::prefix('auth')->name('auth.')->group(function () {
        Route::middleware('throttle:auth')->group(function () {
            Route::post('register', [AuthController::class, 'register'])->name('register');
            Route::post('login', [AuthController::class, 'login'])->name('login');
            Route::post('forgot-password', [PasswordResetController::class, 'sendLink'])->name('password.email');
            Route::post('reset-password', [PasswordResetController::class, 'reset'])->name('password.update');
        });

        Route::get('email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
            ->middleware(['signed:relative', 'throttle:6,1'])
            ->name('verification.verify');

        Route::middleware('auth:sanctum')->group(function () {
            Route::get('me', [AuthController::class, 'me'])->name('me');
            Route::post('logout', [AuthController::class, 'logout'])->name('logout');
            Route::post('email/resend', [EmailVerificationController::class, 'resend'])
                ->middleware('throttle:3,1')
                ->name('verification.send');
        });
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::put('profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::put('profile/password', [ProfileController::class, 'updatePassword'])->name('profile.password');

        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::post('orders', [OrderController::class, 'store'])->middleware('throttle:10,1')->name('orders.store');
        Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
        Route::post('orders/{order}/files', [OrderController::class, 'upload'])->middleware('throttle:30,1')->name('orders.files.store');
        Route::get('orders/{order}/files/{file}', [OrderController::class, 'download'])->name('orders.files.show');
        Route::post('orders/{order}/messages', [OrderController::class, 'message'])->middleware('throttle:20,1')->name('orders.messages.store');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');
        Route::get('documents', [OrderController::class, 'documents'])->name('documents.index');

        Route::prefix('agreements')->name('agreements.')->group(function () {
            Route::get('/', [AgreementController::class, 'index'])->name('index');
            Route::get('{legalDocument}', [AgreementController::class, 'show'])->name('show');
            Route::get('{legalDocument}/file', [AgreementController::class, 'file'])->name('file');
            Route::post('{legalDocument}/sign', [AgreementController::class, 'sign'])->middleware('throttle:10,1')->name('sign');
            Route::get('{legalDocument}/signed', [AgreementController::class, 'signed'])->name('signed');
        });

        Route::get('my-bookings', [BookingController::class, 'index'])->name('bookings.index');
        Route::get('plans', [PlanController::class, 'index'])->name('plans.index');

        Route::prefix('mailbox')->name('mailbox.')->group(function () {
            Route::get('/', [MailboxController::class, 'index'])->name('index');
            Route::get('items/{item}/scan', [MailboxController::class, 'scan'])->name('items.scan');
            Route::post('items/{item}/request', [MailboxController::class, 'request'])->middleware('throttle:20,1')->name('items.request');
            Route::delete('items/{item}/request', [MailboxController::class, 'cancelRequest'])->name('items.request.destroy');
        });
        Route::prefix('consultations')->name('consultations.')->group(function () {
            Route::get('/', [ConsultationController::class, 'index'])->name('index');
            Route::post('/', [ConsultationController::class, 'store'])->middleware('throttle:10,1')->name('store');
            Route::get('{consultation}', [ConsultationController::class, 'show'])->name('show');
            Route::post('{consultation}/cancel', [ConsultationController::class, 'cancel'])->middleware('throttle:10,1')->name('cancel');
        });

        Route::apiResource('businesses', BusinessController::class);
        Route::prefix('compliance')->name('compliance.')->group(function () {
            Route::get('/', [ComplianceController::class, 'index'])->name('index');
            Route::post('businesses/{business}/items', [ComplianceController::class, 'store'])->middleware('throttle:30,1')->name('items.store');
            Route::patch('items/{item}', [ComplianceController::class, 'update'])->name('items.update');
            Route::delete('items/{item}', [ComplianceController::class, 'destroy'])->name('items.destroy');
        });

        Route::post('plans/passes', [PlanController::class, 'buyPass'])->middleware('throttle:10,1')->name('plans.passes.store');
        Route::post('plans/memberships', [PlanController::class, 'buyMembership'])->middleware('throttle:10,1')->name('plans.memberships.store');
        Route::patch('plans/{kind}/{id}/auto-renew', [PlanController::class, 'autoRenew'])->whereIn('kind', ['passes', 'memberships'])->whereNumber('id')->name('plans.auto-renew');
        Route::post('plans/{kind}/{id}/renew', [PlanController::class, 'renew'])->whereIn('kind', ['passes', 'memberships'])->whereNumber('id')->middleware('throttle:10,1')->name('plans.renew');

        Route::prefix('billing')->name('billing.')->group(function () {
            Route::get('options', [BillingController::class, 'options'])->name('options');
            Route::get('invoices', [BillingController::class, 'invoices'])->name('invoices.index');
            Route::get('invoices/{invoice}', [BillingController::class, 'invoice'])->name('invoices.show');
            Route::post('invoices/{invoice}/coupon', [BillingController::class, 'applyCoupon'])->middleware('throttle:10,1')->name('invoices.coupon.store');
            Route::delete('invoices/{invoice}/coupon', [BillingController::class, 'removeCoupon'])->middleware('throttle:10,1')->name('invoices.coupon.destroy');
            Route::post('invoices/{invoice}/pay', [BillingController::class, 'pay'])->middleware('throttle:10,1')->name('invoices.pay');
            Route::post('invoices/{invoice}/bank-transfer', [BillingController::class, 'bankTransfer'])->middleware('throttle:5,1')->name('invoices.bank-transfer');
            Route::get('payments', [BillingController::class, 'payments'])->name('payments.index');
            Route::get('payments/{payment:reference}', [BillingController::class, 'payment'])->name('payments.show');
            Route::post('payments/{payment:reference}/verify', [BillingController::class, 'verify'])->middleware('throttle:20,1')->withoutScopedBindings()->name('payments.verify');
            Route::get('payments/{payment:reference}/receipt', [BillingController::class, 'receipt'])->name('payments.receipt');
            Route::get('payments/{payment:reference}/proof', [BillingController::class, 'proof'])->name('payments.proof');
            Route::get('cards', [PaymentMethodController::class, 'index'])->name('cards.index');
            Route::post('cards/{card}/default', [PaymentMethodController::class, 'makeDefault'])->name('cards.default');
            Route::delete('cards/{card}', [PaymentMethodController::class, 'destroy'])->name('cards.destroy');
        });

        Route::prefix('admin')->name('admin.')->middleware(['staff', 'audit'])->group(function () {
            Route::get('dashboard', [DashboardController::class, 'summary'])->name('dashboard');
            Route::get('activity', [ActivityLogController::class, 'index'])->middleware('permission:audit.view')->name('activity.index');
            Route::get('meta/staff-roles', [MetaController::class, 'staffRoles'])->name('meta.staff-roles');

            Route::middleware('permission:customers.view')->group(function () {
                Route::get('customers', [UserController::class, 'index'])->name('customers.index');
                Route::get('customers/{user}', [UserController::class, 'show'])->name('customers.show');
            });
            Route::patch('customers/{user}/status', [UserController::class, 'updateStatus'])
                ->middleware('permission:customers.manage')
                ->name('customers.status');

            Route::middleware('permission:services.manage')->group(function () {
                Route::get('meta/field-types', [MetaController::class, 'fieldTypes'])->name('meta.field-types');
                Route::apiResource('service-categories', ServiceCategoryController::class)
                    ->parameters(['service-categories' => 'category'])
                    ->except('show');
                Route::apiResource('services', ServiceController::class);
                Route::put('services/{service}/fields', [ServiceBuilderController::class, 'fields'])->name('services.fields');
                Route::put('services/{service}/requirements', [ServiceBuilderController::class, 'requirements'])->name('services.requirements');
                Route::put('services/{service}/stages', [ServiceBuilderController::class, 'stages'])->name('services.stages');
                Route::apiResource('bundles', BundleController::class)->except('show');
            });

            Route::prefix('workspace')->name('workspace.')->middleware('permission:workspace.manage')->group(function () {
                Route::apiResource('locations', LocationController::class);
                Route::apiResource('space-types', SpaceTypeController::class)->except('show');
                Route::apiResource('spaces', SpaceController::class);
                Route::post('spaces/{space}/photo', [SpaceController::class, 'photo'])->name('spaces.photo');
                Route::delete('spaces/{space}/photo', [SpaceController::class, 'removePhoto'])->name('spaces.photo.destroy');
                Route::apiResource('spaces.seats', SpaceSeatController::class)->except('show')->scoped();
                Route::apiResource('addons', AddonController::class)->except('show');
                Route::apiResource('closures', BlackoutDateController::class)->except('show')->parameters(['closures' => 'closure']);
                Route::apiResource('cancellation-policies', CancellationPolicyController::class)->except('show');
                Route::apiResource('pass-plans', PassPlanController::class)->except('show');
                Route::apiResource('membership-plans', MembershipPlanController::class)->except('show');
            });

            Route::middleware('permission:documents.manage')->group(function () {
                Route::get('legal-documents/customers', [LegalDocumentController::class, 'customers'])->name('legal-documents.customers');
                Route::apiResource('legal-documents', LegalDocumentController::class)->parameters(['legal-documents' => 'legalDocument']);
                Route::get('legal-documents/{legalDocument}/file', [LegalDocumentController::class, 'file'])->name('legal-documents.file');
                Route::get('legal-documents/{legalDocument}/signed/{user}', [LegalDocumentController::class, 'signed'])->name('legal-documents.signed');
            });

            Route::prefix('reports')->name('reports.')->middleware('permission:reports.view')->group(function () {
                Route::get('summary', [ReportController::class, 'summary'])->name('summary');
                Route::get('payments.csv', [ReportController::class, 'paymentsCsv'])->name('payments-csv');
            });

            Route::prefix('bookings')->name('bookings.')->group(function () {
                Route::middleware('permission:bookings.manage|bookings.checkin')->group(function () {
                    Route::get('/', [AdminBookingController::class, 'index'])->name('index');
                    Route::get('day', [AdminBookingController::class, 'day'])->name('day');
                    Route::post('check-in', [AdminBookingController::class, 'checkInByCode'])->name('check-in-by-code');
                    Route::get('{booking}', [AdminBookingController::class, 'show'])->name('show');
                    Route::post('{booking}/check-in', [AdminBookingController::class, 'checkIn'])->name('check-in');
                });
                Route::middleware('permission:bookings.manage')->group(function () {
                    Route::post('{booking}/cancel', [AdminBookingController::class, 'cancel'])->name('cancel');
                    Route::post('{booking}/approve', [AdminBookingController::class, 'approve'])->name('approve');
                    Route::post('{booking}/decline', [AdminBookingController::class, 'decline'])->name('decline');
                    Route::get('{booking}/seats', [AdminBookingController::class, 'seats'])->name('seats');
                    Route::put('{booking}/seats', [AdminBookingController::class, 'moveSeats'])->name('seats.update');
                });
            });

            Route::prefix('orders')->name('orders.')->middleware('permission:orders.view_assigned|orders.view_all')->group(function () {
                Route::get('/', [AdminOrderController::class, 'index'])->name('index');
                Route::get('summary', [AdminOrderController::class, 'summary'])->name('summary');
                Route::get('assignees', [AdminOrderController::class, 'assignees'])->name('assignees');
                Route::get('{order}', [AdminOrderController::class, 'show'])->name('show');
                Route::post('{order}/assign', [AdminOrderController::class, 'assign'])->name('assign');
                Route::post('{order}/start', [AdminOrderController::class, 'start'])->name('start');
                Route::post('{order}/stage', [AdminOrderController::class, 'stage'])->name('stage');
                Route::post('{order}/request-info', [AdminOrderController::class, 'requestInfo'])->name('request-info');
                Route::post('{order}/complete', [AdminOrderController::class, 'complete'])->name('complete');
                Route::post('{order}/cancel', [AdminOrderController::class, 'cancel'])->name('cancel');
                Route::post('{order}/files', [AdminOrderController::class, 'upload'])->name('files.store');
                Route::get('{order}/files/{file}', [AdminOrderController::class, 'download'])->name('files.show');
                Route::post('{order}/files/{file}/review', [AdminOrderController::class, 'reviewFile'])->name('files.review');
                Route::post('{order}/messages', [AdminOrderController::class, 'message'])->name('messages.store');
            });

            Route::prefix('blog')->name('blog.')->middleware('permission:content.manage')->group(function () {
                Route::post('images', [BlogPostController::class, 'image'])->middleware('throttle:30,1')->name('images.store');
                Route::post('preview', [BlogPostController::class, 'preview'])->name('preview');
                Route::post('{post}/cover', [BlogPostController::class, 'cover'])->name('cover');
                Route::delete('{post}/cover', [BlogPostController::class, 'removeCover'])->name('cover.destroy');
            });
            Route::apiResource('blog', BlogPostController::class)->parameters(['blog' => 'post'])->middleware('permission:content.manage');

            Route::prefix('consultations')->name('consultations.')->group(function () {
                Route::middleware('permission:consultations.manage')->group(function () {
                    Route::apiResource('types', ConsultationTypeController::class)->except('show')->parameters(['types' => 'consultationType']);
                    Route::post('{consultation}/cancel', [AdminConsultationController::class, 'cancel'])->name('cancel');
                });
                Route::middleware('permission:consultations.manage|consultations.view_assigned')->group(function () {
                    Route::get('/', [AdminConsultationController::class, 'index'])->name('index');
                    Route::get('{consultation}', [AdminConsultationController::class, 'show'])->name('show');
                    Route::patch('{consultation}', [AdminConsultationController::class, 'update'])->name('update');
                    Route::post('{consultation}/outcome', [AdminConsultationController::class, 'outcome'])->name('outcome');
                });
            });

            Route::prefix('appointments')->name('appointments.')->middleware('permission:appointments.manage')->group(function () {
                Route::get('clients', [AdminAppointmentController::class, 'clients'])->name('clients');
                Route::get('staff', [AdminAppointmentController::class, 'staff'])->name('staff');
                Route::get('settings', [AdminAppointmentController::class, 'settings'])->name('settings.show');
                Route::put('settings', [AdminAppointmentController::class, 'updateSettings'])->name('settings.update');
                Route::get('/', [AdminAppointmentController::class, 'index'])->name('index');
                Route::post('/', [AdminAppointmentController::class, 'store'])->name('store');
                Route::get('{appointment}', [AdminAppointmentController::class, 'show'])->name('show');
                Route::patch('{appointment}', [AdminAppointmentController::class, 'update'])->name('update');
                Route::post('{appointment}/cancel', [AdminAppointmentController::class, 'cancel'])->name('cancel');
                Route::post('{appointment}/outcome', [AdminAppointmentController::class, 'outcome'])->name('outcome');
            });

            Route::prefix('compliance')->name('compliance.')->middleware('permission:compliance.manage')->group(function () {
                Route::get('/', [AdminComplianceController::class, 'index'])->name('index');
                Route::patch('items/{item}', [AdminComplianceController::class, 'update'])->name('items.update');
            });

            Route::prefix('mail')->name('mail.')->middleware('permission:mail.manage')->group(function () {
                Route::get('/', [AdminMailboxController::class, 'queue'])->name('queue');
                Route::get('customers', [AdminMailboxController::class, 'customers'])->name('customers');
                Route::get('locations', [AdminMailboxController::class, 'locations'])->name('locations');
                Route::get('mailboxes', [AdminMailboxController::class, 'index'])->name('mailboxes.index');
                Route::post('mailboxes', [AdminMailboxController::class, 'store'])->name('mailboxes.store');
                Route::get('mailboxes/{mailbox}', [AdminMailboxController::class, 'show'])->name('mailboxes.show');
                Route::put('mailboxes/{mailbox}', [AdminMailboxController::class, 'update'])->name('mailboxes.update');
                Route::post('mailboxes/{mailbox}/items', [AdminMailboxController::class, 'logMail'])->name('mailboxes.items.store');
                Route::post('items/{item}/scan', [AdminMailboxController::class, 'uploadScan'])->name('items.scan.store');
                Route::get('items/{item}/scan', [AdminMailboxController::class, 'scan'])->name('items.scan');
                Route::post('items/{item}/handle', [AdminMailboxController::class, 'handle'])->name('items.handle');
            });

            Route::prefix('finance')->name('finance.')->group(function () {
                Route::apiResource('coupons', CouponController::class)->middleware('permission:coupons.manage');
                Route::middleware('permission:payments.view')->group(function () {
                    Route::get('summary', FinanceSummaryController::class)->name('summary');
                    Route::get('renewals', RenewalController::class)->name('renewals');
                    Route::get('payments', [AdminPaymentController::class, 'index'])->name('payments.index');
                    Route::get('payments/{payment:reference}', [AdminPaymentController::class, 'show'])->name('payments.show');
                    Route::get('payments/{payment:reference}/proof', [AdminPaymentController::class, 'proof'])->name('payments.proof');
                });
                Route::middleware('permission:payments.verify')->group(function () {
                    Route::post('payments/{payment:reference}/approve', [AdminPaymentController::class, 'approve'])->name('payments.approve');
                    Route::post('payments/{payment:reference}/reject', [AdminPaymentController::class, 'reject'])->name('payments.reject');
                });
                Route::post('payments/{payment:reference}/refunds', [AdminPaymentController::class, 'refund'])
                    ->middleware('permission:refunds.process')
                    ->name('payments.refund');

                Route::middleware('permission:invoices.manage')->group(function () {
                    Route::get('invoices', [AdminInvoiceController::class, 'index'])->name('invoices.index');
                    Route::post('invoices', [AdminInvoiceController::class, 'store'])->name('invoices.store');
                    Route::get('invoices/{invoice}', [AdminInvoiceController::class, 'show'])->name('invoices.show');
                    Route::post('invoices/{invoice}/void', [AdminInvoiceController::class, 'void'])->name('invoices.void');
                });
            });

            Route::prefix('settings')->name('settings.')->middleware('permission:settings.manage')->group(function () {
                Route::get('payments', [PaymentSettingsController::class, 'index'])->name('payments');
                Route::put('payments/gateways/{gateway:code}', [PaymentSettingsController::class, 'updateGateway'])->name('payments.gateways.update');
                Route::post('payments/gateways/{gateway:code}/test', [PaymentSettingsController::class, 'testGateway'])
                    ->middleware('throttle:10,1')
                    ->name('payments.gateways.test');
                Route::put('payments/bank-transfer', [PaymentSettingsController::class, 'updateBankTransfer'])->name('payments.bank-transfer');
                Route::apiResource('bank-accounts', BankAccountController::class)->only(['store', 'update', 'destroy']);

                Route::get('signatory', [SignatoryController::class, 'show'])->name('signatory.show');
                Route::put('signatory', [SignatoryController::class, 'update'])->name('signatory.update');

                Route::get('workspace', [WorkspaceSettingsController::class, 'show'])->name('workspace.show');
                Route::put('workspace', [WorkspaceSettingsController::class, 'update'])->name('workspace.update');

                Route::get('mail', [MailSettingsController::class, 'show'])->name('mail.show');
                Route::put('mail', [MailSettingsController::class, 'update'])->name('mail.update');
                Route::post('mail/test', [MailSettingsController::class, 'test'])->middleware('throttle:5,1')->name('mail.test');

                Route::get('whatsapp', [WhatsAppSettingsController::class, 'show'])->name('whatsapp.show');
                Route::put('whatsapp', [WhatsAppSettingsController::class, 'update'])->name('whatsapp.update');
                Route::post('whatsapp/test', [WhatsAppSettingsController::class, 'test'])->middleware('throttle:5,1')->name('whatsapp.test');

                Route::get('email-templates', [EmailTemplateController::class, 'index'])->name('email-templates.index');
                Route::put('email-templates/{key}', [EmailTemplateController::class, 'update'])->name('email-templates.update');
                Route::post('email-templates/{key}/reset', [EmailTemplateController::class, 'reset'])->name('email-templates.reset');
                Route::post('email-templates/{key}/preview', [EmailTemplateController::class, 'preview'])->name('email-templates.preview');
                Route::post('email-templates/{key}/test', [EmailTemplateController::class, 'test'])->middleware('throttle:5,1')->name('email-templates.test');
            });

            Route::middleware('permission:staff.manage')->group(function () {
                Route::get('staff', [StaffController::class, 'index'])->name('staff.index');
                Route::post('staff', [StaffController::class, 'store'])->name('staff.store');
                Route::patch('staff/{user}', [StaffController::class, 'update'])->name('staff.update');
            });
        });
    });
});
