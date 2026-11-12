# Putting Reenite live: Hostinger (API) + Vercel (website)

This guide takes the app from your computer to the internet. Follow the parts in order. Each step says where to click or what to type.

| Part | Lives on | Address |
|---|---|---|
| API, database, uploaded files, emails, backups (`api/` folder) | Hostinger | `https://api.reenite.com` |
| Website, booking, customer dashboard, admin (`web/` folder) | Vercel | `https://reenite.com` (`www.reenite.com` redirects to it) |
| Email (`hello@reenite.com` and the rest) | Wherever it is now | unchanged |

`reenite.com` runs your WordPress site today. The new site replaces it, but only after you have tested it (Part D). Until then you test on the address Vercel gives you, and WordPress stays live for visitors.

---

## Before you start

You need:

- [ ] A Hostinger plan with **SSH access** and **cron jobs**: Premium, Business or Cloud. hPanel > Advanced > SSH Access shows whether SSH is on.
- [ ] A **GitHub** account. Vercel deploys from GitHub. (The project is not in Git yet. Ask Claude to set up the repository when you are ready.)
- [ ] A **Vercel** account. Use the free Hobby plan for testing. A business site should be on **Pro** (about $20 a month), because Hobby is for non-commercial use only.
- [ ] Your **Paystack** live keys (you will type them into the admin yourself, never into a file or a chat).
- [ ] An **email sending service** such as Resend, Mailgun or Hostinger's own email (SMTP details).
- [ ] A long random secret, shared by both halves. Create one on your computer with:

  ```bash
  openssl rand -hex 32
  ```

  Keep it somewhere safe. Below it is called **INTERNAL_API_KEY**.

---

## Part A: the API on Hostinger

### A1. Create the database

1. hPanel > **Databases > MySQL Databases**.
2. Create a database (for example `u123456789_reenite`), a user and a strong password.
3. Write down the database name, user name and password.

### A2. Create the subdomain

1. hPanel > **Domains > Subdomains**, create `api.reenite.com`.
2. hPanel > **Advanced > PHP Configuration**: pick **PHP 8.3 or newer** for this site. Make sure these extensions are ticked: `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `zip`, `intl`.
3. hPanel > **Security > SSL**: install the free SSL certificate for `api.reenite.com`.

### A3. Upload the code

Connect with SSH (hPanel > Advanced > SSH Access shows the command), then:

```bash
cd ~
git clone https://github.com/YOUR-ACCOUNT/reenite.git reenite      # or upload a zip of the project and unzip it here
cd ~/reenite/api
php -v                                                             # must say 8.3 or newer
composer install --no-dev --optimize-autoloader
```

If `php -v` shows an older version, the newer one has its own path, for example `/opt/alt/php83/usr/bin/php`. Ask Hostinger support for the exact path and use it in place of `php` everywhere below, including the cron job.

### A4. Point the subdomain at the API's `public` folder

Only `api/public` may be reachable from the internet. Everything else (your `.env`, uploaded documents, backups) must stay private. Replace the subdomain's folder with a link to `public`:

```bash
ls ~/domains/reenite.com/public_html/          # find the folder Hostinger made for "api"
rm -rf ~/domains/reenite.com/public_html/api   # it is empty: Hostinger just created it
ln -s ~/reenite/api/public ~/domains/reenite.com/public_html/api
```

(If your plan shows the subdomain in a different folder, use that path instead.)

### A5. Settings

```bash
cd ~/reenite/api
cp .env.production.example .env
nano .env
```

Fill in:

- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`: from step A1.
- `INTERNAL_API_KEY`: the secret from "Before you start".
- `APP_URL` and `FRONTEND_URL`: leave as they are unless you use different addresses.

Save (Ctrl+O, Enter, Ctrl+X), then:

```bash
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --class=ProductionSeeder --force   # roles, settings, services and workspace. No demo accounts.
ln -s ~/reenite/api/storage/app/public ~/reenite/api/public/storage   # makes uploaded photos reachable (Hostinger blocks `php artisan storage:link`)
php artisan config:cache
php artisan route:cache
php artisan app:create-admin you@reenite.com --name="Your Name"   # asks for a password
```

**Do not run plain `php artisan db:seed` on the live server.** It creates the demo accounts that use the password "password".

Check it works: open `https://api.reenite.com/up` in your browser. It should say the application is up.

### A6. The cron job (bookings, reminders, emails and backups)

hPanel > **Advanced > Cron Jobs** > add a job that runs **every minute**:

```
cd /home/u123456789/reenite/api && php artisan schedule:run >> /dev/null 2>&1
```

Use your own home folder (run `pwd` over SSH to see it). This one job runs everything:

| What | When |
|---|---|
| Release unpaid booking and consultation holds | every minute |
| Send queued emails and jobs (`QUEUE_FROM_SCHEDULER=true`) | every minute |
| Mark finished bookings complete | every 15 minutes |
| Booking and consultation reminders, ending passes and memberships | hourly |
| Renewals: 3-day notices, charging saved cards for auto-renew (up to 3 daily tries), cancelling renewals unpaid 14 days after the plan ended | hourly |
| Payment reminders (3 days before an invoice is due, on the day, 3 and 7 days late) and one "finish your booking" email for abandoned checkouts | daily, 9am Lagos time |
| Roll the compliance calendar forward (monthly VAT and PAYE, yearly returns) | daily, 5am Lagos time |
| Compliance deadline reminders (14 days, 3 days, and once when missed) | daily, 8am Lagos time |
| Database backup | daily, 2am Lagos time |
| Database **and uploaded files** backup | Sundays, 2:30am |
| Delete activity log entries older than a year | daily |

---

## Part B: the website on Vercel

1. vercel.com > **Add New > Project** > import the GitHub repository.
2. **Root Directory:** `web`. Framework: Next.js (found automatically).
3. **Environment Variables** (copy from `web/.env.production.example`):

   | Name | Value |
   |---|---|
   | `API_URL` | `https://api.reenite.com` |
   | `NEXT_PUBLIC_SITE_URL` | `https://reenite.com` |
   | `INTERNAL_API_KEY` | the same secret as the API |

4. Deploy.
5. Project > **Settings > Functions > Region**: choose the region closest to your Hostinger server. hPanel shows the server's location. For example, the United Kingdom is `lhr1`, and France, the Netherlands or Lithuania are `cdg1` or `fra1`. Every page talks to the API, so a far-away region makes the site slow.
6. Open the address Vercel shows (something like `reenite-web.vercel.app`) and do Part C there. Don't add a domain yet.

While you test on the Vercel address, links in emails and QR codes already say `reenite.com`, which still shows WordPress. That's expected and goes away after Part D.

---

## Part C: first sign-in and settings

Go to the Vercel address from B6 (after Part D, `https://reenite.com`), open `/login`, and sign in with the admin you created in A5. Then, under **Admin > Settings**:

1. **Email delivery:** enter your SMTP details, send the test email, and switch delivery on.
2. **Payment gateways:** turn on Paystack, choose **Live**, and paste the keys yourself. In the Paystack dashboard, set the webhook URL to:

   ```
   https://api.reenite.com/api/v1/webhooks/paystack
   ```

   (Flutterwave: `.../webhooks/flutterwave`. Stripe: `.../webhooks/stripe`.)
3. **Bank transfer:** add the account customers can pay into.
4. **Signatory:** the founder's name, title and signature for legal documents.
5. **Space booking:** leave it on book.reenite.com until you are ready to take bookings here.

Then:

- **Admin > Services:** replace the placeholder prices with your real prices.
- **Admin > Workspace:** check spaces, prices, passes and add-ons.
- **Admin > Staff & Roles:** invite your team. Each person gets only the access their role needs.
- Read `/privacy` and `/terms`, and fill in the company's legal name, RC number and contact email in `web/src/content/site.ts` (`legalEntity`). A lawyer should review both before launch.

**Test before telling customers:** create a customer account with your own email, order a cheap service, pay a small real amount, and check that the payment, email and order tracker all work. Then refund it from Admin > Finance.

---

## Part D: move reenite.com from WordPress to the new site

Do this once Part C works on the Vercel address. Pick a quiet time: visitors may see either site for up to a few hours while DNS updates.

### D1. Before you switch

1. **Back up WordPress** (hPanel > Files > Backups, or a backup plugin). Leave its files on Hostinger. Nothing below deletes them, and pointing the domain back undoes the switch.
2. **Copy the blog over** while WordPress is still live. Over SSH:

   ```bash
   cd ~/reenite/api && php artisan blog:import-wordpress
   ```

   It copies every post with its photos, dates, authors and Google descriptions, and lists them as `copied`. Check them under **Admin > Blog**. Running it again skips posts already copied, so it's safe to repeat if you publish another post on WordPress before switching.
   Every old WordPress address already has a permanent redirect to its new page (`web/next.config.ts`): posts move from `/post-name` to `/blog/post-name`, and pages like `/book-a-space` go to `/book`. Old links and Google rankings carry over. If you add WordPress pages before switching, ask Claude to add their redirects.
3. hPanel > **Domains > reenite.com > DNS / Nameservers**: take a screenshot of every record. Check that `api` has its **own** A record. If it doesn't, add one pointing to the same IP the root (`@`) record shows now, so the API stays on Hostinger when the root moves.

### D2. Add the domain on Vercel

Project > **Settings > Domains**: add `reenite.com`, then `www.reenite.com`, and set `www` to redirect to `reenite.com`. Vercel shows the exact records it wants. Use those if they differ from the table below.

### D3. Change DNS in Hostinger

hPanel > **Domains > reenite.com > DNS / Nameservers**:

| Type | Name | Change |
|---|---|---|
| A | `@` | Edit it to Vercel's IP, `76.76.21.21` (delete any other `A` or `AAAA` records on `@`) |
| CNAME | `www` | `cname.vercel-dns.com` (replace the existing `www` record) |

**Leave everything else alone**: `MX`, `TXT` (SPF, DKIM, DMARC), `mail`, `api`, `scholarship` and `book`. Email keeps working because it uses the `MX` records, not the website's.

DNS changes take from a few minutes to a few hours. Vercel issues the SSL certificate by itself, and the Domains page turns green when it's done.

### D4. After the switch

- Open `https://reenite.com` and `https://www.reenite.com` in a private window, and sign in at `https://reenite.com/login`.
- Send yourself a password reset and check that the email's link opens `reenite.com`.
- Google Search Console: submit `https://reenite.com/sitemap.xml`.
- Update `reenite.com` links you control: Google Business Profile, Instagram and other social bios, the WhatsApp Business profile, and printed QR codes if any point at old WordPress pages.
- Once bookings run on this site (Part C, step 5), point `book.reenite.com` to the new site: add it in Vercel Domains as a redirect to `https://reenite.com/book`, and change its DNS record to `CNAME cname.vercel-dns.com`.
- Keep the WordPress backup for a few months, then cancel any WordPress-only hosting add-ons.

---

## Part E: updating the live site later

Website: push to GitHub and Vercel deploys automatically.

API, over SSH:

```bash
cd ~/reenite && git pull
cd api
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache
php artisan queue:restart
```

`migrate` also gives staff roles any new permissions (for example `coupons.manage`, `mail.manage`, `compliance.manage` and `consultations.manage`), so there's no permissions seeder to run after an update.

**Once, after the update that added consultations:** add the three starter consultations (placeholder prices you can change under Admin > Consultations > Set up):

```bash
php artisan db:seed --class=ConsultationTypeSeeder --force
```

---

## Backups

- **Where:** `~/reenite/api/storage/app/private/backups/`. That folder is private and never reachable from the web. The last 14 days are kept.
- **Run one now:** `php artisan app:backup` (database) or `php artisan app:backup --files` (database and uploads).
- **Second copy:** turn on Hostinger's own daily backups (hPanel > Files > Backups).
- **Third copy:** once a month, download the latest `files_*.zip` and `database_*.sql.gz` to a computer or cloud drive.
- **Restore a database:** `gunzip -c database_FILE.sql.gz | mysql -u USER -p DATABASE`.

---

## Security already in place

- Sign-in, sign-up and password resets are limited to 10 attempts a minute, and to 30 an hour for any one email address.
- Bookings, payments, uploads and messages have their own limits.
- **Admin > Activity log** (Super Admins only) shows every admin change, every sign-in and every failed sign-in, with the IP address and device. Entries are kept for a year.
- The website passes each visitor's real IP address to the API, signed with `INTERNAL_API_KEY`. That is why both sides need the same secret.
- Payment keys are stored encrypted. Uploaded documents are private and stream through the website only to people allowed to see them.
- `APP_DEBUG=false` in production, so error pages never show code or settings.

---

## Automatic renewals (Paystack)

Customers can tick **"Save this card"** when paying by card with Paystack. Paystack keeps the card; we store only its reusable authorisation (encrypted) and the last 4 digits. Passes and memberships set to renew automatically are charged to the default card the day before they end. Customers manage cards under Billing and switch renewal on or off on their Workspace page; staff see what's renewing, what failed and what's overdue under **Admin > Finance > Renewals**.

Saved cards belong to the Paystack mode they were saved in: test cards are never charged in live mode, so customers save their card again on their first live payment.

---

## WhatsApp messages (optional)

Customers who switch on "Send me updates on WhatsApp" in their settings get booking, order, mail, deadline and consultation updates on WhatsApp as well as by email. It uses Meta's WhatsApp Cloud API:

1. In Meta Business Manager, add a WhatsApp Business account and a phone number (it can't already be used in the WhatsApp app).
2. Create a System User with a **permanent** access token that has `whatsapp_business_messaging` permission.
3. In WhatsApp Manager, create a message template for each event you want. Admin > Settings > WhatsApp lists the values each one receives as `{{1}}`, `{{2}}`..., in order. Wait for Meta to approve them.
4. In Admin > Settings > WhatsApp, enter the phone number ID, the token and each approved template name, switch it on, and send a test.

If WhatsApp is off, a template is missing, or Meta refuses a message, the email still goes out and the failure is written to the log.

---

## Upload size limit

Vercel accepts at most **4.5MB** in a single request to the website's server, and uploads pass through the website on their way to the API. So every upload (customer documents, deliverables, transfer receipts, legal PDFs, space photos, mail scans) is capped at **3MB**. The limit is set in two places that must match: `api/app/Uploads/UploadLimit.php` and `web/src/lib/uploads.ts`.

---

## Troubleshooting

| Problem | Check |
|---|---|
| `api.reenite.com` shows a file list or "403" | The link in A4 is missing or points to the wrong folder. |
| Uploaded photos show as broken images | The `public/storage` link is missing. `ls -la ~/reenite/api/public/storage` should point to `storage/app/public`. If not, run `php artisan storage:link`. If that fails with "`symlink()` is disabled" or "undefined function exec()" (Hostinger blocks both), run `ln -s ~/reenite/api/storage/app/public ~/reenite/api/public/storage` instead. |
| "500 Server Error" | `tail -50 ~/reenite/api/storage/logs/laravel-*.log` |
| Website says it can't reach the server | `API_URL` on Vercel, and `https://api.reenite.com/up` opens. |
| Emails don't arrive | Admin > Settings > Email delivery test. Is the cron job running? `php artisan schedule:list` |
| Bookings stay "held" | The cron job isn't running. |
| Activity log shows the same IP for everyone | `INTERNAL_API_KEY` is different on Vercel and Hostinger. |
| Settings change has no effect | Run `php artisan config:cache` again after editing `.env`. |
