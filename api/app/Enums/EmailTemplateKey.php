<?php

namespace App\Enums;

/**
 * System emails whose wording admins can edit. Each case carries its default copy and
 * the placeholders it supports, and a group for the editor's list.
 */
enum EmailTemplateKey: string
{
    case EmailVerification = 'email_verification';
    case PasswordReset = 'password_reset';
    case StaffInvite = 'staff_invite';
    case PasswordChanged = 'password_changed';
    case InvoiceIssued = 'invoice_issued';
    case PaymentReceipt = 'payment_receipt';
    case TransferReceived = 'transfer_received';
    case TransferRejected = 'transfer_rejected';
    case OrderReceived = 'order_received';
    case OrderUpdated = 'order_updated';
    case InfoRequested = 'info_requested';
    case OrderCompleted = 'order_completed';
    case OrderMessage = 'order_message';
    case BookingConfirmed = 'booking_confirmed';
    case BookingAwaitingPayment = 'booking_awaiting_payment';
    case BookingPendingApproval = 'booking_pending_approval';
    case BookingReminder = 'booking_reminder';
    case BookingCancelled = 'booking_cancelled';
    case GuestAccountInvite = 'guest_account_invite';
    case PassActivated = 'pass_activated';
    case PassExpiring = 'pass_expiring';
    case MembershipActivated = 'membership_activated';
    case MembershipRenewalDue = 'membership_renewal_due';
    case MailReceived = 'mail_received';
    case MailScanned = 'mail_scanned';
    case DocumentToSign = 'document_to_sign';
    case StaffOrderAssigned = 'staff_order_assigned';
    case StaffTransferToReview = 'staff_transfer_to_review';
    case StaffNewBooking = 'staff_new_booking';
    case StaffMailRequest = 'staff_mail_request';

    /**
     * Groups in the order the editor lists them.
     */
    public const GROUPS = ['Account', 'Billing', 'Orders', 'Bookings', 'Passes and memberships', 'Virtual office', 'Documents', 'Staff alerts'];

    public function group(): string
    {
        return match ($this) {
            self::EmailVerification, self::PasswordReset, self::StaffInvite, self::PasswordChanged => 'Account',
            self::InvoiceIssued, self::PaymentReceipt, self::TransferReceived, self::TransferRejected => 'Billing',
            self::OrderReceived, self::OrderUpdated, self::InfoRequested, self::OrderCompleted, self::OrderMessage => 'Orders',
            self::BookingConfirmed, self::BookingAwaitingPayment, self::BookingPendingApproval, self::BookingReminder,
            self::BookingCancelled, self::GuestAccountInvite => 'Bookings',
            self::PassActivated, self::PassExpiring, self::MembershipActivated, self::MembershipRenewalDue => 'Passes and memberships',
            self::MailReceived, self::MailScanned => 'Virtual office',
            self::StaffOrderAssigned, self::StaffTransferToReview, self::StaffNewBooking, self::StaffMailRequest => 'Staff alerts',
            self::DocumentToSign => 'Documents',
        };
    }

    public function name(): string
    {
        return match ($this) {
            self::EmailVerification => 'Verify email',
            self::PasswordReset => 'Password reset',
            self::StaffInvite => 'Staff invitation',
            self::PasswordChanged => 'Password changed',
            self::InvoiceIssued => 'New invoice',
            self::PaymentReceipt => 'Payment receipt',
            self::TransferReceived => 'Transfer received',
            self::TransferRejected => 'Transfer not confirmed',
            self::OrderReceived => 'Order received',
            self::OrderUpdated => 'Order progress update',
            self::InfoRequested => 'Information needed',
            self::OrderCompleted => 'Order completed',
            self::OrderMessage => 'New message on an order',
            self::BookingConfirmed => 'Booking confirmed',
            self::BookingAwaitingPayment => 'Booking held, payment needed',
            self::BookingPendingApproval => 'Booking request received',
            self::BookingReminder => 'Booking reminder',
            self::BookingCancelled => 'Booking cancelled',
            self::GuestAccountInvite => 'Guest: create an account',
            self::PassActivated => 'Pass activated',
            self::PassExpiring => 'Pass running out',
            self::MembershipActivated => 'Membership activated',
            self::MembershipRenewalDue => 'Membership renewal due',
            self::StaffOrderAssigned => 'Order assigned to you',
            self::StaffTransferToReview => 'Bank transfer to check',
            self::StaffNewBooking => 'New booking',
            self::DocumentToSign => 'Document to sign',
            self::MailReceived => 'New mail arrived',
            self::MailScanned => 'Mail scanned',
            self::StaffMailRequest => 'Mail request from a customer',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::EmailVerification => 'Sent when a customer signs up, with a link to confirm their email.',
            self::PasswordReset => 'Sent when someone asks to reset a forgotten password.',
            self::StaffInvite => 'Sent to new team members so they can set their password.',
            self::PasswordChanged => 'Security alert after a password is changed or reset.',
            self::InvoiceIssued => 'Sent when the team raises an invoice for a customer.',
            self::PaymentReceipt => 'Sent when a payment succeeds, with a link to the receipt.',
            self::TransferReceived => 'Confirms we received proof of a bank transfer and are checking it.',
            self::TransferRejected => "Sent when Finance can't confirm a bank transfer.",
            self::OrderReceived => 'Sent once an order is paid, confirming the team has it.',
            self::OrderUpdated => 'Sent when an order moves to a new customer-visible stage.',
            self::InfoRequested => 'Sent when the officer needs something from the customer.',
            self::OrderCompleted => 'Sent when an order is finished and documents are ready.',
            self::OrderMessage => 'Sent when the officer replies in the order chat.',
            self::BookingConfirmed => 'Sent when a booking is paid or approved, with the check-in code.',
            self::BookingAwaitingPayment => 'Sent when a space is held for someone paying by bank transfer.',
            self::BookingPendingApproval => 'Sent when a space needs approval before the booking is confirmed.',
            self::BookingReminder => 'Sent the day before a booking starts.',
            self::BookingCancelled => 'Sent when a booking is cancelled, with any refund due.',
            self::GuestAccountInvite => 'Sent to guests after they book, inviting them to create an account to manage bookings.',
            self::PassActivated => 'Sent when a customer buys a flexible pass such as 3 days a week.',
            self::PassExpiring => 'Sent a few days before a pass period ends while visits are left.',
            self::MembershipActivated => 'Sent when a membership starts.',
            self::MembershipRenewalDue => 'Sent before a membership renews, with the amount due.',
            self::StaffOrderAssigned => 'Tells an officer an order has been assigned to them.',
            self::StaffTransferToReview => 'Tells Finance a customer has sent proof of a bank transfer.',
            self::StaffNewBooking => 'Tells the front desk about a new confirmed booking.',
            self::DocumentToSign => 'Sent when the team shares an agreement for the customer to read and sign online.',
            self::MailReceived => 'Sent when the front desk logs a letter or parcel for a virtual office customer.',
            self::MailScanned => 'Sent when a scan of a letter is ready to view.',
            self::StaffMailRequest => 'Tells the front desk a customer wants mail collected, forwarded, scanned or shredded.',
        };
    }

    /**
     * Sign-in depends on these; turning them off is allowed but the admin is warned.
     */
    public function isEssential(): bool
    {
        return in_array($this, [self::EmailVerification, self::PasswordReset, self::StaffInvite], true);
    }

    /**
     * @return array<string, string> placeholder => what it contains
     */
    public function placeholders(): array
    {
        $common = ['name' => "Recipient's full name", 'first_name' => "Recipient's first name", 'app_name' => 'Your business name (Reenite)'];
        $booking = [
            'booking_reference' => 'Booking number', 'space_name' => 'Space', 'location_name' => 'Location',
            'location_address' => 'Location address', 'booking_date' => 'Date', 'booking_time' => 'Start and end time', 'guests' => 'Number of people',
        ];

        $mail = ['mailbox_number' => 'Mailbox number, e.g. RN-0012', 'business_name' => 'Name on the mailbox', 'mail_kind' => 'Letter, parcel or official letter', 'sender' => 'Who sent it', 'received_date' => 'Date it arrived'];

        return match ($this) {
            self::EmailVerification, self::PasswordReset => $common + ['expires_minutes' => 'Minutes until the link expires'],
            self::StaffInvite => $common + ['role' => 'Their staff role', 'invited_by' => 'Who invited them', 'expires_minutes' => 'Minutes until the link expires'],
            self::PasswordChanged => $common + ['changed_at' => 'Date and time of the change'],
            self::InvoiceIssued => $common + ['invoice_number' => 'Invoice number', 'amount' => 'Amount due', 'due_date' => 'Due date'],
            self::PaymentReceipt => $common + ['invoice_number' => 'Invoice number', 'amount' => 'Amount paid', 'receipt_number' => 'Receipt number', 'payment_method' => 'How they paid'],
            self::TransferReceived => $common + ['invoice_number' => 'Invoice number', 'amount' => 'Amount transferred'],
            self::TransferRejected => $common + ['invoice_number' => 'Invoice number', 'amount' => 'Amount transferred', 'reason' => 'Why it was rejected'],
            self::OrderReceived => $common + ['order_reference' => 'Order number', 'service_name' => 'Service', 'due_date' => 'Expected completion date'],
            self::OrderUpdated => $common + ['order_reference' => 'Order number', 'service_name' => 'Service', 'stage_name' => 'New stage'],
            self::InfoRequested => $common + ['order_reference' => 'Order number', 'service_name' => 'Service', 'message' => "The officer's request", 'officer_name' => 'Officer name'],
            self::OrderCompleted => $common + ['order_reference' => 'Order number', 'service_name' => 'Service'],
            self::OrderMessage => $common + ['order_reference' => 'Order number', 'service_name' => 'Service', 'message' => 'The message', 'officer_name' => 'Officer name'],
            self::BookingConfirmed => $common + $booking + ['amount' => 'Amount paid', 'check_in_code' => 'Code to show at reception', 'cancellation_policy' => 'Cancellation terms'],
            self::BookingAwaitingPayment => $common + $booking + ['amount' => 'Amount due', 'hold_expires' => 'When the hold ends'],
            self::BookingPendingApproval, self::BookingReminder => $common + $booking,
            self::BookingCancelled => $common + $booking + ['refund_amount' => 'Refund due (or "No refund")', 'reason' => 'Why it was cancelled'],
            self::GuestAccountInvite => $common + ['booking_reference' => 'Booking number', 'email' => 'The email they booked with'],
            self::PassActivated => $common + ['pass_name' => 'Pass', 'allowance' => 'e.g. 3 visits a week', 'valid_until' => 'End of the current period', 'amount' => 'Amount paid'],
            self::PassExpiring => $common + ['pass_name' => 'Pass', 'credits_left' => 'Visits or hours left', 'valid_until' => 'End of the current period'],
            self::MembershipActivated => $common + ['plan_name' => 'Membership', 'discount' => 'Booking discount, e.g. 15%', 'renews_on' => 'Renewal date', 'amount' => 'Amount paid'],
            self::MembershipRenewalDue => $common + ['plan_name' => 'Membership', 'renews_on' => 'Renewal date', 'amount' => 'Amount due'],
            self::StaffOrderAssigned => $common + ['order_reference' => 'Order number', 'service_name' => 'Service', 'customer_name' => 'Customer', 'due_date' => 'Due date', 'assigned_by' => 'Who assigned it'],
            self::StaffTransferToReview => $common + ['invoice_number' => 'Invoice number', 'amount' => 'Amount transferred', 'customer_name' => 'Customer'],
            self::StaffNewBooking => $common + $booking + ['customer_name' => 'Customer or guest', 'amount' => 'Amount paid'],
            self::DocumentToSign => $common + ['document_title' => 'Name of the document'],
            self::MailReceived, self::MailScanned => $common + $mail,
            self::StaffMailRequest => $common + $mail + ['customer_name' => 'Customer', 'request' => 'What they asked for', 'request_note' => 'Their note, e.g. a forwarding address'],
        };
    }

    /**
     * @return array{subject: string, heading: string, body: string, button_text: string|null, footer: string|null}
     */
    public function defaults(): array
    {
        return match ($this) {
            self::EmailVerification => [
                'subject' => 'Confirm your email for {{app_name}}',
                'heading' => 'Welcome, {{first_name}}!',
                'body' => "Thanks for creating your {{app_name}} account. Please confirm your email address so we can keep you updated about your orders and bookings.\n\nThis link expires in {{expires_minutes}} minutes.",
                'button_text' => 'Confirm my email',
                'footer' => "If you didn't create an account, you can safely ignore this email.",
            ],
            self::PasswordReset => [
                'subject' => 'Reset your {{app_name}} password',
                'heading' => 'Hi {{first_name}},',
                'body' => "We received a request to reset the password for your {{app_name}} account.\n\nThis link expires in {{expires_minutes}} minutes.",
                'button_text' => 'Choose a new password',
                'footer' => "If you didn't ask for this, you can ignore this email. Your password won't change.",
            ],
            self::StaffInvite => [
                'subject' => "You've been invited to the {{app_name}} team",
                'heading' => 'Welcome to the team, {{first_name}}!',
                'body' => "{{invited_by}} has added you to {{app_name}} as {{role}}.\n\nSet your password to sign in to the admin console. This link expires in {{expires_minutes}} minutes.",
                'button_text' => 'Set my password',
                'footer' => 'If you think this was sent by mistake, please let us know.',
            ],
            self::PasswordChanged => [
                'subject' => 'Your {{app_name}} password was changed',
                'heading' => 'Hi {{first_name}},',
                'body' => 'The password for your {{app_name}} account was changed on {{changed_at}}.',
                'button_text' => 'Sign in',
                'footer' => "If you didn't make this change, reset your password straight away and contact us.",
            ],
            self::InvoiceIssued => [
                'subject' => 'Invoice {{invoice_number}} from {{app_name}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "We've sent you invoice {{invoice_number}} for {{amount}}, due by {{due_date}}.\n\nYou can pay online or by bank transfer from your dashboard.",
                'button_text' => 'View and pay',
                'footer' => 'Questions about this invoice? Just reply to this email.',
            ],
            self::PaymentReceipt => [
                'subject' => 'Receipt {{receipt_number}}: payment received',
                'heading' => 'Thank you, {{first_name}}!',
                'body' => "We've received your payment of {{amount}} for invoice {{invoice_number}} by {{payment_method}}.\n\nYour receipt number is {{receipt_number}}.",
                'button_text' => 'View receipt',
                'footer' => 'Keep this email for your records.',
            ],
            self::TransferReceived => [
                'subject' => "We've received your transfer details",
                'heading' => 'Hi {{first_name}},',
                'body' => "Thanks for sending proof of your {{amount}} transfer for invoice {{invoice_number}}.\n\nOur finance team will confirm it shortly, usually within one working day. We'll email you as soon as it's done.",
                'button_text' => 'View invoice',
                'footer' => null,
            ],
            self::TransferRejected => [
                'subject' => "We couldn't confirm your transfer for {{invoice_number}}",
                'heading' => 'Hi {{first_name}},',
                'body' => "We couldn't confirm your {{amount}} bank transfer for invoice {{invoice_number}}.\n\nReason: {{reason}}\n\nPlease check the details and upload your proof again, or pay online.",
                'button_text' => 'View invoice',
                'footer' => 'If you think this is a mistake, reply to this email and we will look into it.',
            ],
            self::OrderReceived => [
                'subject' => "We've got your order {{order_reference}}",
                'heading' => 'Thanks, {{first_name}}!',
                'body' => "Your payment for {{service_name}} is confirmed and our team has started on order {{order_reference}}.\n\nWe expect to finish by {{due_date}}. You can follow every step from your dashboard.",
                'button_text' => 'Track my order',
                'footer' => "If anything's missing, your officer will message you.",
            ],
            self::OrderUpdated => [
                'subject' => 'Update on {{order_reference}}: {{stage_name}}',
                'heading' => 'Hi {{first_name}},',
                'body' => 'Good news: your {{service_name}} order {{order_reference}} has moved to "{{stage_name}}".',
                'button_text' => 'View progress',
                'footer' => null,
            ],
            self::InfoRequested => [
                'subject' => 'Action needed on {{order_reference}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "{{officer_name}} needs something from you to continue your {{service_name}} order:\n\n{{message}}",
                'button_text' => 'Respond now',
                'footer' => 'Your order is paused until we hear back.',
            ],
            self::OrderCompleted => [
                'subject' => 'Done! Your {{service_name}} is complete',
                'heading' => 'Congratulations, {{first_name}}!',
                'body' => 'Order {{order_reference}} is complete. Your documents are ready to download from your dashboard.',
                'button_text' => 'Get my documents',
                'footer' => "Thank you for choosing {{app_name}}. Building a business? Don't build alone.",
            ],
            self::OrderMessage => [
                'subject' => 'New message about {{order_reference}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "{{officer_name}} wrote:\n\n{{message}}",
                'button_text' => 'Reply',
                'footer' => null,
            ],
            self::BookingConfirmed => [
                'subject' => "You're booked: {{space_name}} on {{booking_date}}",
                'heading' => "You're all set, {{first_name}}!",
                'body' => "Your booking {{booking_reference}} is confirmed.\n\n{{space_name}}, {{location_name}}\n{{booking_date}}, {{booking_time}}\nPeople: {{guests}}\nPaid: {{amount}}\n\nShow this code at reception when you arrive: {{check_in_code}}\n\nFind us at {{location_address}}.",
                'button_text' => 'View booking',
                'footer' => 'Cancellation terms: {{cancellation_policy}}',
            ],
            self::BookingAwaitingPayment => [
                'subject' => 'Your {{space_name}} booking is on hold',
                'heading' => 'Hi {{first_name}},',
                'body' => "We're holding {{space_name}} at {{location_name}} for you on {{booking_date}}, {{booking_time}}.\n\nPay {{amount}} before {{hold_expires}} to confirm booking {{booking_reference}}. After that the space is released.",
                'button_text' => 'Pay now',
                'footer' => 'Paying by bank transfer? Upload your proof of payment and we will confirm it.',
            ],
            self::BookingPendingApproval => [
                'subject' => "We've received your booking request {{booking_reference}}",
                'heading' => 'Thanks, {{first_name}}!',
                'body' => "You've asked to book {{space_name}} at {{location_name}} on {{booking_date}}, {{booking_time}} for {{guests}}.\n\nOur team will review it and get back to you shortly, usually within one working day.",
                'button_text' => 'View request',
                'footer' => null,
            ],
            self::BookingReminder => [
                'subject' => 'See you tomorrow at {{location_name}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "A reminder that you've booked {{space_name}} for {{booking_date}}, {{booking_time}}.\n\nWe're at {{location_address}}. Show your booking code at reception when you arrive.",
                'button_text' => 'View booking',
                'footer' => "Can't make it? You can cancel from your booking page.",
            ],
            self::BookingCancelled => [
                'subject' => 'Booking {{booking_reference}} cancelled',
                'heading' => 'Hi {{first_name}},',
                'body' => "Your booking for {{space_name}} on {{booking_date}}, {{booking_time}} has been cancelled.\n\n{{reason}}\n\nRefund: {{refund_amount}}",
                'button_text' => 'Book again',
                'footer' => 'Refunds usually reach your account within 5 to 10 working days.',
            ],
            self::GuestAccountInvite => [
                'subject' => 'Keep track of your {{app_name}} bookings',
                'heading' => 'Thanks for booking, {{first_name}}!',
                'body' => "Create a free {{app_name}} account with {{email}} to see booking {{booking_reference}} and all your future bookings in one place, rebook in a click and download receipts.\n\nYour existing bookings will be added to your account automatically.",
                'button_text' => 'Create my account',
                'footer' => 'No account? No problem. You can still use the links in your booking emails.',
            ],
            self::PassActivated => [
                'subject' => 'Your {{pass_name}} pass is active',
                'heading' => 'Welcome aboard, {{first_name}}!',
                'body' => "Your {{pass_name}} pass is ready: {{allowance}}.\n\nThis period runs until {{valid_until}}. Book a space from your dashboard and your visits are used automatically.\n\nPaid: {{amount}}",
                'button_text' => 'Book a space',
                'footer' => null,
            ],
            self::PassExpiring => [
                'subject' => 'You have {{credits_left}} left on your {{pass_name}} pass',
                'heading' => 'Hi {{first_name}},',
                'body' => 'Your {{pass_name}} pass period ends on {{valid_until}} and you still have {{credits_left}} left. Book now so they don\'t go to waste.',
                'button_text' => 'Book a space',
                'footer' => 'Unused visits do not roll over to the next period.',
            ],
            self::MembershipActivated => [
                'subject' => 'Welcome to {{app_name}} {{plan_name}}',
                'heading' => "You're a member, {{first_name}}!",
                'body' => "Your {{plan_name}} membership is active. You now get {{discount}} off every booking, applied automatically.\n\nPaid: {{amount}}. Your membership renews on {{renews_on}}.",
                'button_text' => 'See my membership',
                'footer' => null,
            ],
            self::MembershipRenewalDue => [
                'subject' => 'Your {{plan_name}} membership renews on {{renews_on}}',
                'heading' => 'Hi {{first_name}},',
                'body' => 'Your {{plan_name}} membership renews on {{renews_on}}. Pay {{amount}} to keep your member discount and perks.',
                'button_text' => 'Renew now',
                'footer' => "If you don't renew, your membership ends on that date.",
            ],
            self::StaffOrderAssigned => [
                'subject' => 'New order for you: {{order_reference}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "{{assigned_by}} has assigned you {{service_name}} for {{customer_name}} (order {{order_reference}}).\n\nIt's due by {{due_date}}.",
                'button_text' => 'Open the order',
                'footer' => null,
            ],
            self::StaffTransferToReview => [
                'subject' => 'Transfer to check: {{amount}} for {{invoice_number}}',
                'heading' => 'Hi {{first_name}},',
                'body' => '{{customer_name}} has sent proof of a {{amount}} bank transfer for invoice {{invoice_number}}. Please check it against the bank statement.',
                'button_text' => 'Review transfer',
                'footer' => null,
            ],
            self::StaffNewBooking => [
                'subject' => 'New booking: {{space_name}}, {{booking_date}}',
                'heading' => 'New booking {{booking_reference}}',
                'body' => "{{customer_name}} booked {{space_name}} at {{location_name}}.\n\n{{booking_date}}, {{booking_time}}\nPeople: {{guests}}\nPaid: {{amount}}",
                'button_text' => 'View booking',
                'footer' => null,
            ],
            self::DocumentToSign => [
                'subject' => 'Please sign: {{document_title}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "{{app_name}} has shared \"{{document_title}}\" for you to read and sign.\n\nIt's already signed on our side. Add your signature online in a minute, then download your signed copy any time from your dashboard.",
                'button_text' => 'Read and sign',
                'footer' => 'Questions about this document? Just reply to this email.',
            ],
            self::MailReceived => [
                'subject' => 'New mail for {{business_name}}',
                'heading' => 'You have mail, {{first_name}}',
                'body' => "New {{mail_kind}} from {{sender}} arrived for mailbox {{mailbox_number}} on {{received_date}}.\n\nTell us what to do with it: hold it for collection, forward it, scan it or shred it.",
                'button_text' => 'Open my mailbox',
                'footer' => 'We keep mail safe at the front desk until you tell us what to do.',
            ],
            self::MailScanned => [
                'subject' => 'Your scan is ready: {{mail_kind}} from {{sender}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "We've scanned the {{mail_kind}} from {{sender}} that arrived on {{received_date}}. You can read it in your mailbox now.\n\nWe're still holding the original. Let us know if you'd like it collected, forwarded or shredded.",
                'button_text' => 'Read the scan',
                'footer' => null,
            ],
            self::StaffMailRequest => [
                'subject' => 'Mail request: {{request}} for {{mailbox_number}}',
                'heading' => 'Hi {{first_name}},',
                'body' => "{{customer_name}} ({{business_name}}, mailbox {{mailbox_number}}) asked: {{request}}.\n\nItem: {{mail_kind}} from {{sender}}, received {{received_date}}.\nNote: {{request_note}}",
                'button_text' => 'Open mail requests',
                'footer' => null,
            ],
        };
    }
}
