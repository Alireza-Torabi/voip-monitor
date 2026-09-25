<div dir="rtl" align="right">

# تأیید سازگاری با PBX واقعی

**نوع:** Runbook
**نسخه:** 0.1.0
**وضعیت:** Active
**آخرین به‌روزرسانی:** 2026-09-25
**محیط:** فقط آزمون کنترل‌شده
**مخاطب:** مدیران VoIP و پلتفرم
**مجوز:** Apache-2.0

## هدف

هدف این Runbook بررسی Provider مربوط به Asterisk روی یک PBX واقعی و مورد تأیید است، بدون اینکه Credential، آدرس‌ها یا اطلاعات توپولوژی استقرار وارد Git شوند.

این آزمون از دید Call Control فقط‌خواندنی است. اتصال AMI برقرار می‌شود، تنظیمات Core خوانده می‌شوند، فهرست کانال‌های فعال گرفته می‌شود، رویدادهای AMI برای یک بازهٔ محدود مشاهده می‌شوند، Snapshot دوم برای Reconciliation گرفته می‌شود و در پایان Logoff انجام می‌شود. این ابزار هیچ تماس جدیدی ایجاد نمی‌کند، تماس را Hangup یا Redirect نمی‌کند، Reload انجام نمی‌دهد، تنظیمات PBX را تغییر نمی‌دهد و CLI Command اجرا نمی‌کند.

## پیش‌نیازها

- PBX هدف و بازهٔ آزمون باید صریحاً تأیید شده باشند.
- مسیر شبکه از سرور مانیتورینگ تا AMI مجاز باشد.
- AMI فقط از مسیر خصوصی، مورد اعتماد یا محافظت‌شده قابل دسترسی باشد.
- ترجیحاً یک AMI Account اختصاصی و محدود استفاده شود.
- Repository با Toolchain پشتیبانی‌شدهٔ Node.js Build شده باشد.

</div>
<div dir="rtl" align="right">

در Asterisk 13، Source رسمی نشان می‌دهد Actionهای `CoreSettings` و `CoreShowChannels` در کلاس‌های `system` و `reporting` ثبت شده‌اند و Eventهای کانال و Call در کلاس `call` قرار دارند. از آنجا که AMI برای مجوز Actionها از Write Permission Mask استفاده می‌کند، یک Account محدود برای این Verification ممکن است به `write = system,reporting` و `read = call` نیاز داشته باشد. این مقدارها باید با Policy همان PBX بررسی شوند و نباید صرفاً برای راحتی Permission بیشتری داده شود.

مراجع:

- Source رسمی Asterisk 13: https://github.com/asterisk/asterisk/blob/13/main/manager.c
- مشخصات AMI v2: https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/AMI-v2-Specification/

## آماده‌سازی Credential محلی

Password واقعی را در Command Line، فایل Environment قابل Track، Ticket یا فایل‌های Repository قرار ندهید.

از ریشهٔ Repository دستور زیر را اجرا کنید:

</div>

```sh
./scripts/setup-real-pbx-verification.sh
```
<div dir="rtl" align="right">

این Helper به‌صورت تعاملی اطلاعات را می‌گیرد و فقط در مسیر Ignoreشدهٔ زیر ذخیره می‌کند:

</div>

```text
.local/real-pbx-verification/config.json
.local/real-pbx-verification/ami-password
```

<div dir="rtl" align="right">

Directory با Mode برابر 0700 و فایل‌ها با Mode برابر 0600 ساخته می‌شوند. هنگام واردکردن AMI Password، Echo ترمینال خاموش است. اگر مسیر `.local/` توسط Git Ignore نشده باشد، Helper ادامه نمی‌دهد.

## اجرای Verification

ابتدا Build را اجرا کنید:

</div>

```sh
npm ci --ignore-scripts
npm run build
```

<div dir="rtl" align="right">

سپس یک Observation کوتاه اجرا کنید:

</div>
```sh
node scripts/verify-real-pbx-compatibility.mjs --observe-seconds 60
```

<div dir="rtl" align="right">

در این بازه اپراتور می‌تواند یک تماس عادی آزمایشی از طریق PBX برقرار کند. خود Verifier هیچ تماس یا تغییری ایجاد نمی‌کند.

نتیجهٔ کامل فقط در Local Storage Ignoreشده ذخیره می‌شود:

</div>

```text
.local/real-pbx-verification/last-result.json
```

<div dir="rtl" align="right">

خروجی Console فقط PASS/FAIL امن را نمایش می‌دهد.

## معیار قبولی

۱. Login به AMI موفق باشد.
۲. Discovery با `CoreSettings` موفق باشد.
۳. `CoreShowChannels` یک Event-list کامل و سازگار برگرداند.
۴. Snapshot دوم برای Reconciliation موفق باشد.
۵. Provider بدون Reconnect ناامن Connected بماند یا به‌درستی Recover شود.
۶. اگر تماس آزمایشی برقرار شد، Eventهای Normalized مورد انتظار برای Version هدف دیده شوند.
۷. هیچ Credential، Host، Username، Channel Identity یا Call Detail واقعی وارد Git یا CI نشود.

</div>
<div dir="rtl" align="right">

قبولی این Probe فقط سازگاری همان PBX، Version و مسیر شبکهٔ تست‌شده را نشان می‌دهد و به‌تنهایی به معنی Production Ready بودن برنامه نیست.

## خطا و Rollback

- بعد از Failure متوقف شوید و Permissionهای AMI را بدون بررسی گسترده‌تر نکنید.
- ابتدا فقط Safe Error Code را بررسی کنید.
- نتیجهٔ Detailدار را فقط در `.local/` نگه دارید.
- اگر تغییری روی PBX لازم شد، قبل از اجرا باید Change، Risk، Verification و Rollback دقیق مشخص شود.
- خود Verifier هیچ تغییر Persistشونده‌ای روی PBX ایجاد نمی‌کند.

برای حذف اطلاعات Local Verification:

</div>

```sh
rm -rf .local/real-pbx-verification
```

<div dir="rtl" align="right">

## نکات امنیتی

Config محلی، Password File، نتیجهٔ Detailدار، Packet Capture، Raw AMI Transcript، Screenshot دارای اطلاعات واقعی، Database تولیدی و Master Key هرگز نباید Commit شوند. CI باید همیشه Synthetic بماند و نباید به PBX واقعی متصل شود.

</div>
