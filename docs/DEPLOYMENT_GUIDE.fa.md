<div dir="rtl">

# راهنمای استقرار در شرکت یا محیط جدید

هدف: استقرار VoIP Monitor در یک سازمان جدید بدون انتقال Data، Credential، Topology، Certificate، Database یا فرض وابسته به محیط قبلی.

## Portability و Isolation

هر Deployment مستقل و متعلق به همان سازمان است. SQLite Database، Master Key، Bootstrap Token، AMI/SSH Credential، Hostname/IP، Fingerprint، TLS Key، PBX Profile ID، Monitoring History، Log، Screenshot، Packet Capture یا فایل‌های `.local/` از محیط دیگری کپی نشوند. فایل‌های Track‌شده Repository عمومی و Generic هستند و Runtime Factها باید بیرون Git بمانند.

یک Fresh Clone باید فقط با Valueهای همان سازمان قابل استقرار باشد. هیچ Default، Test، Example، Document، Migration یا Source Track‌شده نباید به Lab یا شرکت فعلی وابسته باشد.

## مدل استقرار

Monitor روی Linux Host/VM جدا از مسیر تماس اجرا شود. خرابی Monitor نباید Call را متوقف یا تغییر دهد. Runtime هدف فعلی Node.js 24 با Same-origin HTTPS Gateway است. Asterisk/FreePBX از طریق AMI فقط‌خواندنی Monitor می‌شود. System Metrics به‌صورت اختیاری از Restricted SSH Credential جداگانه استفاده می‌کند.

AMI Transport فعلی Plain TCP است و فقط روی مسیر Trusted/Protected استفاده شود. مقدار امن پیش‌فرض `APP_PBX_NETWORK_MODE=disabled` است و `plain_tcp` باید آگاهانه فعال شود.

## آماده‌سازی Host

Service Account اختصاصی، Persistent Data Directory خصوصی خارج Git Checkout، Environment File خصوصی، TLS Key/Certificate و Firewall/Upstream Policy متناسب با سازمان ایجاد کنید.

نمونه Generic Environment:


</div>

```text
APP_ENV=production
APP_HOST=127.0.0.1
APP_PORT=3000
APP_LOG_LEVEL=info
APP_PBX_NETWORK_MODE=disabled
DATA_PATH=/var/lib/voip-monitor/data
APP_SECRET_DIR=/var/lib/voip-monitor/data/secrets
APP_DATABASE_PATH=/var/lib/voip-monitor/data/monitor.sqlite3
VOIP_MONITOR_TLS_CERT=/etc/voip-monitor/tls/server.crt
VOIP_MONITOR_TLS_KEY=/etc/voip-monitor/tls/server.key
VOIP_MONITOR_HTTPS_PORT=8443
```

<div dir="rtl">


این Pathها فقط مثال هستند و باید طبق Policy سازمان انتخاب شوند.

## Build و Release Gate

از Clean Checkout:


</div>

```sh
export PATH=/path/to/node24/bin:$PATH
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
python3 scripts/check_foundation.py
python3 scripts/check_licenses.py
git status --short --branch
```

<div dir="rtl">


اگر Customer Data یا Environment-specific Value وارد Tracked File شده Deploy نکنید.

## نصب Service

از Installer/Runbook Repository با Node/Data/TLS Pathهای محلی همان سازمان استفاده کنید. Value واقعی را داخل فایل Track‌شده Hardcode نکنید. Self-signed TLS فقط برای محیط Controlled و موقت قابل قبول است؛ Deployment عادی باید Certificate قابل اعتماد داشته باشد.

پس از نصب:


</div>

```sh
systemctl is-enabled voip-monitor
systemctl is-active voip-monitor
curl -k https://127.0.0.1:<https-port>/health
curl -k https://127.0.0.1:<https-port>/ready
```

<div dir="rtl">


یک Reboot Test انجام و Checkها تکرار شود.

## مدیر نخست

در Database تازه، Bootstrap Token فقط از Local Trusted Access سرور خوانده و در Browser Setup Flow استفاده شود. Token در Git، Ticket، Chat، Screenshot یا Environment دائمی ذخیره نشود.

Automatic Password Recovery فعلاً وجود ندارد. Credential مدیر را محافظت و Database + Master Key را به‌صورت یک مجموعه قابل Recovery Backup کنید.

## Onboarding PBX

برای هر PBX:

1. AMI Account فقط‌خواندنی بسازید.
2. AMI Network Access را به Monitor Host یا مسیر مجاز محدود کنید.
3. PBX Profile را از UI اضافه کنید.
4. تا Approval مسیر Network، Network Access را فعال نکنید.
5. `APP_PBX_NETWORK_MODE=plain_tcp` را فقط با Approval صریح فعال کنید.
6. Read-only Connection Verification را اجرا کنید.
7. Provider Status و Normalized Telephony State را بررسی کنید.

Profile/Secret/Address/ID متعلق به سازمان دیگر reuse نشود.

## System Metrics اختیاری با Restricted SSH

CPU، Memory، Filesystem، Uptime و Service State از AMI نمی‌آیند. این داده‌ها به SSH Configuration و Credential اختیاری و PBX-scoped نیاز دارند.

Collector فقط وقتی فعال می‌شود که PBX Profile موجود و Enabled باشد، Network Mode صریحاً Network Access را اجازه دهد، SSH Metadata برای همان PBX وجود داشته باشد، Password یا Private Key رمزنگاری‌شده موجود باشد و Pinned SHA-256 Host-key Fingerprint Match شود.

نبود SSH Config/Credential با `UNAVAILABLE` نمایش داده می‌شود؛ Zero نیست و Application Readiness را Fail نمی‌کند.

Collector فقط Commandهای Read-only ثابت Repository را اجرا می‌کند: `/proc/stat`، `/proc/meminfo`، `df -P -B1`، `/proc/uptime` و `systemctl show` محدود. Privilege وسیع Shell/Admin ندهید.

Administrator احراز هویت‌شده اکنون می‌تواند SSH Metadata و Credentialهای Write-only همان PBX را از Workspace/API اختصاصی System metrics SSH مدیریت کند. هر Mutation موفق Runtime را فوری Sync می‌کند. Save کردن هیچ Host واقعی را Test/Probe نمی‌کند. هیچ Value واقعی SSH در Git قرار نگیرد.

### گرفتن Pinned SSH Host-key Fingerprint

Fingerprint را از Local Console قابل اعتماد روی خود PBX/Host مانیتورشده بگیرید. اگر ED25519 فعال است، این روش ترجیح داده می‌شود:

</div>

```sh
PUB=/etc/ssh/ssh_host_ed25519_key.pub
ssh-keygen -lf "$PUB" -E sha256
```

<div dir="rtl">

فقط مقدار `SHA256:...` را داخل Workspace مربوط به System metrics SSH وارد کنید. از Public Key مربوط به User/Client استفاده نکنید.

در نسخه‌های قدیمی OpenSSH ممکن است خطای `unknown option -- E` دریافت شود. در این حالت بدون Upgrade اجباری PBX می‌توان همان OpenSSH SHA-256 Fingerprint را از Host Public Key محاسبه کرد:

</div>

```sh
PUB=/etc/ssh/ssh_host_ed25519_key.pub
printf 'SHA256:'
awk '{print $2}' "$PUB" \
  | tr -d '\n' \
  | openssl base64 -d -A \
  | openssl dgst -sha256 -binary \
  | openssl base64 -A \
  | tr -d '='
printf '\n'
```

<div dir="rtl">

اگر ED25519 روی آن Server فعال نیست، Public Host-key File مربوط به Algorithm واقعی ارائه‌شده توسط `sshd` را استفاده کنید و Fingerprint همان Key را Pin کنید. Fingerprint محیط یا شرکت دیگری را reuse نکنید.

## محدودیت نمایش Trunk

Discovery فعلی Trunk از Asterisk `SIPshowregistry` استفاده می‌کند و فقط Outbound SIP Registrationها را نشان می‌دهد. Static SIP Peer، Inbound-only Definition و PJSIP Trunk ممکن است وجود داشته باشند ولی نمایش داده نشوند.

خالی بودن Trunk List به معنی نبود Trunk روی PBX نیست. Inventory گسترده‌تر نیازمند Task جدا برای Provider-neutral Discovery و Compatibility Test است و نباید با PBX Actionهای Ad-hoc در Deployment Script حل شود.

## Verification

Health/Ready، HTTPS Login، Provider State، Telephony Synchronization، Current Calls/Channels/Queues/Endpoints، Security SSE Reconnect و System Metrics را بررسی کنید. System Metrics باید `CURRENT` باشد یا در صورت نبود SSH صریحاً `UNAVAILABLE`.

تأیید کنید هیچ Secret یا Real Deployment Fact در `git status`، Tracked File، Public Log یا Screenshot عمومی وجود ندارد.

## Backup و Restore

SQLite Database با Coordinated/Stopped Copy، Master Key متناظر، Deployment Environment/Service Config و TLS Material طبق Policy سازمان Backup شوند. Database بدون Master Key متناظر ممکن است Secretها را غیرقابل‌بازیابی کند.

Restore را در Environment ایزوله Test کنید.

## Upgrade و Rollback

قبل Upgrade، Database + Master Key Backup، ثبت Release/Commit و Lockfile State، اجرای تمام Gateها، Clean Build، Deploy/Restart و Verification الزامی است.

Rollback باید Application Version سازگار و در صورت نیاز Database Backup قبل از Migration را برگرداند. Database Migrated را کورکورانه Downgrade نکنید.

## Uninstall

Service را Stop/Disable کنید، Runtime Data را طبق Policy آرشیو یا Secure Delete کنید، TLS/Environment/Service Fileهای محلی و Checkout را حذف کنید. قبل از تصمیم درباره Backup Recovery، Master Key را حذف نکنید.

</div>
