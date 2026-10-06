<div dir="rtl" align="right">

# Runbook عملیات Production

**نوع:** Runbook
**نسخه:** 1.0.0
**وضعیت:** Active
**آخرین به‌روزرسانی:** 2026-10-06
**محیط:** Production / Staging
**مخاطب:** مدیر سیستم و Operator سرویس
**مجوز:** Apache-2.0

## هدف

این Runbook برای استقرار، Hardening، Backup، Restore، Upgrade، Rollback و Recovery سرویس VoIP Monitor است؛ بدون اینکه اطلاعات واقعی یک سازمان وارد Repository عمومی شود.

## محدوده و مرز ایمنی

VoIP Monitor فقط Observer است و نباید داخل مسیر Call قرار گیرد. تا وقتی دسترسی Read-only به PBX جداگانه تأیید نشده، مقدار `APP_PBX_NETWORK_MODE=disabled` باقی بماند. عملیات Backup و Restore نیازی به PBX Access ندارد.

Database Runtime، Master Key، Environment File، TLS Private Key، Credentialها، Hostname/IP و Topology واقعی، Private Deployment State هستند و نباید Commit شوند.

## مسیرهای عمومی Production

مسیرهای Generic استفاده‌شده توسط Installer و Unit فعلی:

- Checkout برنامه: `/opt/voip-monitor`
- Runtime Data: `/var/lib/voip-monitor`
- SQLite Database: `/var/lib/voip-monitor/monitor.sqlite3`
- Master Key: `/var/lib/voip-monitor/secrets/master.key`
- Environment File: `/etc/voip-monitor/voip-monitor.env`
- TLS Certificate: `/etc/voip-monitor/tls/server.crt`
- TLS Private Key: `/etc/voip-monitor/tls/server.key`

اگر سازمان مسیر دیگری دارد، معادل تأییدشده همان سازمان استفاده شود.

## بررسی Hardening

Unit Track‌شده دارای UMask محدود، System View فقط‌خواندنی، Private Tmp/Devices، Kernel/Control-group/Clock Protection، Process Visibility محدود، منع Privilege Escalation، Capability Set خالی، محدودیت Namespace/SUID، Native System-call Architecture و Address Family محدود به Unix/IPv4/IPv6 است.

قبل از Install یا Upgrade اجرا شود:

</div>

```sh
systemd-analyze verify deployment/systemd/voip-monitor.service
systemd-analyze security --offline=yes deployment/systemd/voip-monitor.service
```

<div dir="rtl" align="right">

Baseline مربوط به Task 49 روی Ubuntu 24.04 موجود، Exposure برابر `2.8 OK` بود. این عدد به Version سیستم وابسته است؛ معیار اصلی Valid بودن Unit و Review صریح هر Directive ضعیف‌شده است.

بدون Runtime Validation روی Node/OpenSSL/SSH واقعی، Syscall Filter تهاجمی یا `MemoryDenyWriteExecute` اضافه نکنید.

## Gateهای قبل از Deployment

از Clean Checkout و Node.js 24:

</div>

```sh
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

<div dir="rtl" align="right">

اگر Working Tree شامل Private Value یا Deployment Fact واقعی است، Deploy نکنید.

## Backup

### پیش‌شرط

1. مقصد Backup خصوصی، Access-controlled و دارای فضای کافی باشد.
2. Commit/Release در حال اجرا ثبت شود.
3. سرویس Stop و inactive بودن آن Verify شود.
4. قبل از پایان Backup، Master Key حذف یا Rotate نشود.

</div>

```sh
sudo systemctl stop voip-monitor
systemctl is-active voip-monitor
git -C /opt/voip-monitor rev-parse HEAD
```

<div dir="rtl" align="right">

Recovery Set را بسازید:

</div>

```sh
sudo /opt/voip-monitor/scripts/backup-production.sh \
  --database /var/lib/voip-monitor/monitor.sqlite3 \
  --master-key /var/lib/voip-monitor/secrets/master.key \
  --env-file /etc/voip-monitor/voip-monitor.env \
  --tls-cert /etc/voip-monitor/tls/server.crt \
  --tls-key /etc/voip-monitor/tls/server.key \
  --destination /secure/backup/location/voip-monitor-YYYYMMDD-HHMMSS \
  --application-ref <GIT_COMMIT_OR_RELEASE> \
  --confirm-stopped
```

<div dir="rtl" align="right">

Backup Directory با Mode `0700` و فایل‌های آن با Mode `0600` ساخته می‌شوند. Database، Master Key متناظر، Environment File، TLS Material اختیاری، Manifest و SHA-256 Checksum داخل آن قرار می‌گیرد.

این Script Backup را Encrypt نمی‌کند. Recovery Set فقط روی Storage رمزنگاری‌شده و مورد تأیید سازمان نگه‌داری یا منتقل شود.

بعد از Backup سرویس را Start کنید.

</div>

```sh
sudo systemctl start voip-monitor
systemctl is-active voip-monitor
```

<div dir="rtl" align="right">

## Restore Drill

Recovery فقط وقتی معتبر است که Restore واقعاً Test شده باشد. ترجیحاً از VM/Namespace/Staging ایزوله و با PBX Network Mode غیرفعال استفاده کنید.

روی Target متوقف‌شده و Pathهای خالی:

</div>

```sh
sudo /opt/voip-monitor/scripts/restore-production.sh \
  --backup-dir /secure/backup/location/voip-monitor-YYYYMMDD-HHMMSS \
  --database /var/lib/voip-monitor/monitor.sqlite3 \
  --master-key /var/lib/voip-monitor/secrets/master.key \
  --env-file /etc/voip-monitor/voip-monitor.env \
  --tls-cert /etc/voip-monitor/tls/server.crt \
  --tls-key /etc/voip-monitor/tls/server.key \
  --confirm-stopped
```

<div dir="rtl" align="right">

Restore Script قبل از Write، Format و تمام SHA-256 Checksumها را Verify می‌کند و به‌صورت Default روی Target موجود Overwrite نمی‌کند. Overwrite فقط با `--allow-overwrite` صریح ممکن است.

در صورت نیاز Ownership را اصلاح کنید:

</div>

```sh
sudo chown -R voip-monitor:voip-monitor /var/lib/voip-monitor
sudo chown root:voip-monitor /etc/voip-monitor/voip-monitor.env
sudo chmod 0640 /etc/voip-monitor/voip-monitor.env
sudo chown root:root /etc/voip-monitor/tls/server.crt
sudo chown root:voip-monitor /etc/voip-monitor/tls/server.key
sudo chmod 0644 /etc/voip-monitor/tls/server.crt
sudo chmod 0640 /etc/voip-monitor/tls/server.key
```

<div dir="rtl" align="right">

ابتدا با PBX Networking غیرفعال Start و Verify کنید:

</div>

```sh
sudo systemctl start voip-monitor
systemctl is-active voip-monitor
curl -k https://127.0.0.1:<HTTPS_PORT>/health
curl -k https://127.0.0.1:<HTTPS_PORT>/ready
```

<div dir="rtl" align="right">

سپس Login، PBX Profileها، Presence Flag مربوط به Credentialهای رمزنگاری‌شده، Dashboard/Settings و Application State بررسی شود. PBX Access فقط بعد از Recovery موفق و Approval جداگانه دوباره فعال شود.

## Upgrade

1. همه Repository Gateها اجرا شوند.
2. Recovery Set در حالت Service-stopped گرفته شود.
3. Commit فعلی و Target ثبت شوند.
4. Target از Clean Checkout Build شود.
5. Service Install/Restart شود.
6. Systemd، Health/Ready، Login، UI و Monitoring Sourceها Verify شوند.
7. Backup قبل از Upgrade تا پایان Rollback Window نگه‌داری شود.

Database Migrated را کورکورانه Downgrade نکنید.

## Rollback

اگر Release جدید قبل از Migration غیرقابل‌برگشت Fail شد، Commit قبلی و Runtime State سازگار برگردانده شود.

اگر Schema Migration رخ داده، سرویس Stop و Database **همراه Master Key متناظر** از Recovery Set قبل Upgrade Restore شود و بعد Application قدیمی Start شود.

Database و Master Key برای Credentialهای رمزنگاری‌شده یک Recovery Unit هستند.

## تصمیم درباره Cleanup تاریخچه Legacy

Task 48 نوشتن داده جدید در این Tableها را متوقف کرد:

- `system_metric_history`
- `security_event_history`
- `security_alert_history`

Task 49 این Tableها را **Drop نمی‌کند**.

حذف مخرب فقط وقتی مجاز است که همه شرایط زیر برقرار باشند:

1. Replacement مبتنی بر In-memory History در Production برای Observation Window مورد توافق بدون مشکل کار کرده باشد.
2. هیچ Reporting، Backup، Forensic یا Operational Process به Tableهای Legacy وابسته نباشد.
3. Recovery Set جدید Production موجود باشد.
4. همان Recovery Set در Environment ایزوله Restore و Verify شده باشد.
5. Migration حذف جداگانه Review و صریحاً Approve شده باشد.

تا آن زمان Tableهای Legacy فقط Compatibility/Rollback Data غیرفعال هستند. Rowها را دستی پاک نکنید و Migration History را تغییر ندهید.

## Verification بعد از Deployment

</div>

```sh
systemctl is-enabled voip-monitor
systemctl is-active voip-monitor
systemctl --no-pager --full status voip-monitor
curl -k https://127.0.0.1:<HTTPS_PORT>/health
curl -k https://127.0.0.1:<HTTPS_PORT>/ready
```

<div dir="rtl" align="right">

همچنین HTTPS Trust Policy، Login، Telephony Synchronization، Source-backed History، System Metrics، Security Monitoring، SSE Reconnect، Permission فایل‌ها، حفاظت Backup Destination و نبود Private Data در Git بررسی شود.

برای Host جدید یا تغییر اساسی Production، Reboot Recovery Test انجام شود.

## Troubleshooting

اگر Checksum Restore Fail شد، آن را Bypass نکنید. Backup را Damaged/Modified در نظر بگیرید و Recovery Set سالم دیگری استفاده کنید.

اگر بعد از Restore، Health سالم ولی Readiness Fail بود، ابتدا Pair بودن Database/Master Key و Ownership/Permission را بررسی کنید. روی Encrypted Recordها Master Key جدید نسازید.

اگر Service بعد از تغییر Hardening Fail شد، Installed Unit را با Unit Track‌شده مقایسه و Journal را بررسی کنید. فقط با دلیل Runtime مستند یک Directive را Relax کنید و دوباره `systemd-analyze verify` را اجرا کنید.

## مراجع

- `docs/DEPLOYMENT_GUIDE.fa.md`
- `docs/OPERATIONS.fa.md`
- `deployment/systemd/voip-monitor.service`
- `scripts/backup-production.sh`
- `scripts/restore-production.sh`

</div>
