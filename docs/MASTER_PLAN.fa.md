<div dir="rtl" align="right">

# مستر پلن پروژه VoIP Monitor

**وضعیت:** 2026-09-26
**منبع اصلی حقیقت:** `docs/MASTER_PLAN.md`
**قاعده:** این فایل پس از هر Task همراه نسخه انگلیسی به‌روزرسانی می‌شود. جزئیات کامل Failure Log و Decisionهای شماره‌دار در نسخه انگلیسی و `docs/DECISIONS.md` نگهداری می‌شوند.

## هدف پروژه

ساخت سامانه‌ای مستقل و Read-Only برای پایش چند PBX، به‌طوری‌که خرابی سامانه مانیتورینگ هیچ اثری روی مسیر تماس نداشته باشد. Credential، Topology، Log خام و اطلاعات واقعی سازمان فقط در `.local/` یا Runtime Storage می‌مانند و وارد Git عمومی نمی‌شوند.

## وضعیت Roadmap

- [x] Task 1 تا 6: Backend/Frontend پایه، Configuration، SQLite، Secret Store، Authentication و PBX CRUD.
- [x] Task 7 تا 12: Asterisk/AMI، Runtime، Event، Snapshot/Reconciliation و Verification کنترل‌شده Asterisk 13.x.
- [x] Task 13 تا 17: Telephony State Engine، Endpoint، Trunk، Queue و Agent Interaction.
- [x] Task 18 تا 24: System Metrics، Restricted SSH، Trust/Pinning، Runtime، Persistence و HTTP/SSE.
- [x] Task 25 تا 27: Security Event از AMI، Persistence و HTTP/SSE.
- [x] Task 28: ارزیابی محدود و Fail-Closed قوانین Security Alert بدون External Delivery.
- [x] Task 29: Persistence محدود Security Alert شامل History بدون Duplicate، Current State جدا برای هر Rule، Ordering بر اساس Stream در صورت وجود، Retention تراکنشی و Cascade با حذف PBX.

## وضعیت فعلی Git و Handoff

- Task 28 همراه اصلاحات مستندات از طریق PR #30 داخل `main` Merge شده است.
- Branch فعلی: `feature/security-alert-persistence-boundary`
- Task 29 به‌صورت Local پیاده‌سازی شده و هنوز Commit/Push/Merge نشده است.
- Task 29 هیچ اتصال به PBX واقعی، Production Log یا سرویس Notification ایجاد نکرده است.
- Task بعدی پس از Merge شدن Task 29: **Task 30 — ارائه API احرازشده Current/History برای Security Alert و Realtime محدود Alert، بدون External Notification Delivery.**

## Task 29 چه چیزی اضافه کرد؟

- Migration 9 با جدول‌های `security_alert_current` و `security_alert_history`.
- Current State بر اساس ترکیب PBX و Rule نگهداری می‌شود تا Ruleها State یکدیگر را overwrite نکنند.
- History با SHA-256 روی Identity محدود Alert، Duplicate-safe است.
- Stream Generation/Sequence در صورت وجود برای تعیین Alert جدیدتر استفاده می‌شود؛ در غیر این صورت `observedAt` معیار است.
- Prune کردن History داخل همان Transaction انجام می‌شود و Current State را حذف نمی‌کند.
- رکورد Alert فقط Rule ID، زمان، تعداد Eventهای Matchشده و Ordering اختیاری را نگه می‌دارد؛ Raw AMI و Identity/Address ذخیره نمی‌شود.

## Failure و محدودیت Task 29

- در Patch اولیه Migration 9، delimiter پایانی migration جا افتاد. علت، boundary اشتباه در اسکریپت Local جایگزینی متن بود. قبل از اجرای Gateهای کامل با inspection پیدا و اصلاح شد و تست Storage بعد از Fix پاس شد.
- Rule Configuration هنوز Persist نمی‌شود.
- Evaluator هنوز به‌صورت خودکار در Runtime اجرا و نتیجه Match را Persist نمی‌کند؛ Ownership این چرخه هنوز تعریف نشده است.
- Alert API/SSE و External Notification هنوز وجود ندارند.
- Dashboard Production و Backup/Restore کامل و آزموده‌شده هنوز باقی مانده‌اند.

## قاعده پایان هر Task

1. `docs/MASTER_PLAN.md` و این فایل را همگام کن.
2. Task Status، Failure/Bug، Root Cause، Fix، Known Limitations و Exact Next Task را ثبت کن.
3. در صورت نیاز `PROJECT_CONTEXT.md`، `DECISIONS.md`، `ARCHITECTURE.md` و Runbookها را اصلاح کن.
4. `.local/SESSION_HANDOFF.md` را با Git State واقعی و Prompt ادامه‌کار به‌روز کن.
5. Lint، Format Check، Typecheck، Tests، Build، Foundation، License و Secret/Public review را اجرا کن.
6. Commit و Push کن و تا تأیید Merge Task جدید شروع نکن.

</div>
