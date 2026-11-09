# Putting Reenite live: Hostinger (API) + Vercel (website)

This guide takes the app from your computer to the internet. Follow the parts in order. Each step says where to click or what to type.

| Part | Lives on | Address |
|---|---|---|
| API, database, uploaded files, emails, backups (`api/` folder) | Hostinger | `https://api.reenite.com` |
| Website, customer dashboard, admin (`web/` folder) | Vercel | `https://app.reenite.com` |
| Your current WordPress site | Hostinger (unchanged) | `https://reenite.com` |

Start on `app.reenite.com`. When you are happy, `reenite.com` can point to the new site instead (Part F).

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
php artisan storage:link
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
| Release unpaid booking holds | every minute |
| Send queued emails and jobs (`QUEUE_FROM_SCHEDULER=true`) | every minute |
| Mark finished bookings complete | every 15 minutes |
| Booking reminders, ending passes and memberships | hourly |
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
   | `NEXT_PUBLIC_SITE_URL` | `https://app.reenite.com` |
   | `INTERNAL_API_KEY` | the same secret as the API |

4. Deploy.
5. Project > **Settings > Functions > Region**: choose the region closest to your Hostinger server. hPanel shows the server's location. For example, the United Kingdom is `lhr1`, and France, the Netherlands or Lithuania are `cdg1` or `fra1`. Every page talks to the API, so a far-away region makes the site slow.
6. Project > **Settings > Domains**: add `app.reenite.com`. Vercel shows the DNS record it needs (next part).

---

## Part C: DNS (in Hostinger, because it manages reenite.com)

hPanel > **Domains > reenite.com > DNS / Nameservers**:

| Type | Name | Points to |
|---|---|---|
| CNAME | `app` | `cname.vercel-dns.com` |

`api` was created with the subdomain in A2. DNS changes take from a few minutes to a few hours. Vercel issues the SSL certificate by itself.

---

## Part D: first sign-in and settings

Go to `https://app.reenite.com/login` and sign in with the admin you created in A5. Then, under **Admin > Settings**:

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

## Known limit: large uploads on Vercel

Vercel accepts at most **4.5MB** in a single request to the website's server. Uploads currently pass through the website on their way to the API, and the app allows files of up to 10MB. Until this is changed, **uploads over about 4MB will fail on Vercel**. That covers customer documents, deliverables and legal-document PDFs.

The options are:

1. **Lower the limit to 4MB** in the app. Quick, and phone photos and scans are usually smaller.
2. **Send files straight from the browser to the API** with a short-lived upload link, so files never pass through Vercel. This is the proper fix and needs a small code change.
3. **Host the website on Hostinger** as a Node.js app instead of Vercel. This needs a Business or Cloud plan.

Pick one before launch.

---

## Troubleshooting

| Problem | Check |
|---|---|
| `api.reenite.com` shows a file list or "403" | The link in A4 is missing or points to the wrong folder. |
| "500 Server Error" | `tail -50 ~/reenite/api/storage/logs/laravel-*.log` |
| Website says it can't reach the server | `API_URL` on Vercel, and `https://api.reenite.com/up` opens. |
| Emails don't arrive | Admin > Settings > Email delivery test. Is the cron job running? `php artisan schedule:list` |
| Bookings stay "held" | The cron job isn't running. |
| Activity log shows the same IP for everyone | `INTERNAL_API_KEY` is different on Vercel and Hostinger. |
| Settings change has no effect | Run `php artisan config:cache` again after editing `.env`. |
