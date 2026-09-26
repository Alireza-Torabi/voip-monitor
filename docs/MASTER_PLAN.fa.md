<div dir="rtl" align="right">

# مستر پلن پروژه VoIP Monitor

**وضعیت:** 2026-09-26
**منبع اصلی حقیقت:** `docs/MASTER_PLAN.md`
**قاعده:** این فایل باید پس از هر Task همراه نسخه انگلیسی به‌روزرسانی شود. جزئیات فنی بسیار ریز، Failure Log کامل و Decisionهای شماره‌دار در نسخه انگلیسی و `docs/DECISIONS.md` نگهداری می‌شوند.

## هدف پروژه

ساخت یک سامانه مستقل و Read-Only برای پایش چند PBX که خرابی آن هیچ اثری روی مسیر تماس نداشته باشد. اطلاعات واقعی سازمان، Credentialها، Topology، Log خام و نتایج خصوصی فقط در `.local/` یا Runtime Storage نگهداری می‌شوند و وارد Git عمومی نمی‌شوند.

## وضعیت فازها

### فاز ۰ — شناسایی محیط
- [x] بررسی محیط توسعه و ابزارها بدون نصب ناخواسته و بدون اتصال به PBX.

### فاز ۱ — شالوده مخزن عمومی
- [x] Git، اسناد عمومی، License، CI، ساختار Workspace، Secret/Public boundary و Foundation checks.
- [ ] اعتبارسنجی Docker/Compose پس از ایجاد Build Context و Serviceهای واقعی.

### فاز ۲ — شالوده برنامه
- [x] Task 1 تا 6: Backend/Frontend پایه، Configuration، SQLite، Secret Store، First Admin/Auth و PBX CRUD.
- [x] Task 7 تا 12: مرز شبکه Asterisk، AMI TCP، Runtime، Eventها، Snapshot/Reconciliation و Verification کنترل‌شده روی Asterisk 13.x واقعی.
- [x] Task 13 تا 17: State Engine تلفنی، Endpoint، Trunk، Queue و Agent Interaction.
- [x] Task 18 تا 24: System Metrics، Restricted SSH، Trust/Pinning، Runtime، Persistence و HTTP/SSE.
- [x] Task 25 تا 27: Security Event از AMI، Persistence و HTTP/SSE.
- [x] Task 28: ارزیابی محدود و Fail-Closed قوانین هشدار امنیتی روی Security Eventهای نرمال‌شده؛ بدون Delivery خارجی.

## وضعیت فعلی Git و Handoff

- Branch فعلی: `feature/security-alert-rule-boundary`
- Task 28 پیاده‌سازی، Commit و Push شده است.
- `main` هنوز Task 28 را ندارد و روی Merge مربوط به Task 27 قرار دارد.
- بنابراین تا Merge شدن Task 28 **هیچ Task جدیدی نباید شروع شود**.
- Task بعدی پس از تأیید Merge: **Task 29 — تعریف Persistence/Current-State محدود برای Security Alert همراه Deduplication و بدون External Delivery.**
- بازبینی مستندات 2026-09-26 بخشی از بستن Handoff همین Branch است و Task 29 را شروع نمی‌کند.

## محدودیت‌های مهم فعلی

- Telephony State هنوز API/Realtime مرورگر-facing ندارد.
- Alert Persistence، Deduplication State و Notification Delivery هنوز پیاده نشده‌اند.
- Dashboard کامل Production هنوز وجود ندارد.
- Backup/Restore و Production deployment کامل و آزموده‌شده نیست.
- PJSIP و برخی مدل‌های Trunk/Sourceهای امنیتی گسترده‌تر هنوز خارج از Scope پیاده‌سازی فعلی‌اند.
- اتصال واقعی PBX فقط در Gateهای صریحاً تأییدشده مجاز است؛ CI همیشه Synthetic باقی می‌ماند.

## قاعده پایان هر Task

پس از هر Task:
1. `docs/MASTER_PLAN.md` و این فایل را همگام کن.
2. وضعیت Task، Failure/Bug، Root Cause، Fix، Known Limitations و Exact Next Task را ثبت کن.
3. در صورت نیاز `PROJECT_CONTEXT.md`، `DECISIONS.md`، `ARCHITECTURE.md` و Runbookها را اصلاح کن.
4. `.local/SESSION_HANDOFF.md` را با وضعیت واقعی Git و Prompt ادامه‌کار به‌روز کن.
5. Lint، Format Check، Typecheck، Tests، Build، Foundation، License و Secret/Public review را اجرا کن.
6. Commit و Push کن و برای Merge متوقف شو.

</div>
