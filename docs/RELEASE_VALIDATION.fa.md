<div dir="rtl" align="right">

# Release Validation

**نوع:** Release Validation Procedure
**نسخه:** 1.0.0
**وضعیت:** Active
**آخرین به‌روزرسانی:** 2026-10-06
**محیط:** Isolated Validation / Production Release Candidate
**مجوز:** Apache-2.0

## هدف

اثبات اینکه VoIP Monitor می‌تواند از Source تمیز Deploy شود بدون اینکه Private Runtime State از Deployment دیگری وارد شود.

## Fresh-deployment Drill خودکار

با Node.js 24 اجرا شود:

</div>

```sh
./scripts/validate-fresh-deployment.sh \
  --source-repo /path/to/voip-monitor \
  --source-index \
  --node-bin /path/to/node24/bin/node
```

<div dir="rtl" align="right">

Validator از Staged Git Index یک Seed موقت می‌سازد، از آن یک Fresh Clone واقعی ایجاد می‌کند و موارد زیر را Verify می‌کند:

1. هیچ `.local`، Runtime Database، Key، Environment File یا Private Artifact داخل Clone وجود ندارد.
2. `npm ci --ignore-scripts` از Lockfile موفق است.
3. `npm audit --audit-level=high` هیچ High/Critical Vulnerability گزارش نمی‌کند.
4. Production Build و Foundation/License Gateها PASS هستند.
5. Deployment ایزوله با TLS موقت و `APP_PBX_NETWORK_MODE=disabled` بالا می‌آید.
6. Health و Readiness PASS هستند.
7. First-admin Onboarding موفق است.
8. Synthetic PBX Profile و AMI Secret رمزنگاری‌شده بدون PBX Connection ذخیره می‌شوند و Secret Leak وجود ندارد.
9. Stopped-service Recovery Set ساخته می‌شود.
10. Recovery Set داخل Pathهای خالی Restore می‌شود.
11. Application Restore‌شده Restart می‌شود، Login کار می‌کند و PBX Metadata/Secret-presence State باقی می‌ماند.

تمام Runtime Fileها داخل Temporary Directory ساخته و در پایان حذف می‌شوند.

## Evidence فعلی Task 50

در 2026-10-06، Staged-index Fresh-deployment Drill با Node.js 24.21.0 و npm 11.19.0 به‌صورت End-to-end PASS شد. در اولین Clean Install یک Advisory مربوط به Transitive Dependency یعنی `source-map-js` پیدا شد؛ Lockfile از 1.2.1 به نسخه Patch‌شده 1.2.2 ارتقا یافت و Audit مجدد Fresh Clone صفر Vulnerability گزارش کرد.

در Automated Drill هیچ Real PBX، External Source Database، Production Credential یا Runtime Data موجود استفاده نشد.

## Physical Reboot Gate

Automated Drill عمداً Host را Reboot نمی‌کند. Physical Reboot یک Operational Gate جدا است، چون Reboot روی سرویسی که PBX Networking آن فعال است می‌تواند به PBX واقعی Reconnect کند.

Task 50 تا زمانی که Boot Recovery Release فعلی با PBX Network State صریحاً تأییدشده اثبات نشده، Complete نیست. Evidence قابل قبول یکی از این دو حالت است:

- Host با `APP_PBX_NETWORK_MODE=disabled` Reboot شود و سپس Enabled/Active بودن systemd و HTTPS Health/Readiness و Login Verify شوند؛ یا
- Read-only PBX Reconnection در Reboot Gate صریحاً Approve شود و همان Boot/Service Checkها Verify شوند.

Hostی که Configuration فعلی آن باعث PBX Reconnection می‌شود نباید بدون Approval Reboot شود.

## Release Acceptance

Release Candidate فقط وقتی پذیرفته است که:

- تمام Repository Gateها PASS باشند.
- Fresh-deployment Drill از Staged Release Source PASS باشد.
- npm audit هیچ High/Critical Vulnerability نداشته باشد.
- Systemd Unit Validation PASS باشد.
- Physical Reboot Recovery صریحاً اثبات شده باشد.
- Secret/Public-repository Review PASS باشد.
- هیچ Private Deployment Value در Tracked Content وجود نداشته باشد.

</div>

<div dir="rtl" align="right">

## Evidence مربوط به Reboot در 2026-10-06

Host فعلی با Approval صریح برای Reconnect موجود و Read-only در حالت `plain_tcp` Reboot شد. Reboot اول یک Deployment Drift را آشکار کرد: systemd Unit نصب‌شده قدیمی‌تر از Unit Harden‌شده Merge‌شده بود. Unit Merge‌شده نصب و با فایل Track‌شده Match شد و سپس Reboot کنترل‌شده دوم انجام شد.

بعد از Boot دوم، Service در وضعیت Enabled و Active بود، Unit نصب‌شده با Release Track‌شده Match داشت، مسیرهای HTTPS مربوط به `/health` و `/ready` هر دو Status برابر 200 دادند، دسترسی بدون Session به PBX API محافظت‌شده همچنان Reject شد و AMI Transport موجود یک TCP Session روی Port `5038` دوباره برقرار کرد. Validation Workflow هیچ PBX Command یا Probe اضافه‌ای صادر نکرد.

</div>
