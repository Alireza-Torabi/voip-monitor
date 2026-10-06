<div dir="rtl" align="right">

# جهت بازطراحی UI/UX

**نوع:** Product Design Specification
**نسخه:** 0.1.0
**وضعیت:** Draft
**آخرین به‌روزرسانی:** 2026-10-06
**مخاطب:** Product، Design و Frontend Engineering
**مجوز:** Apache-2.0

## هدف

VoIP Monitor باید به یک Operations Console مدرن برای مانیتورینگ لحظه‌ای PBX تبدیل شود. ظاهر جدید باید امروزی، حرفه‌ای، متراکم ولی خوانا و در شرایط عملیاتی سریع‌الفهم باشد. هدف صرفاً تعویض رنگ و Radius نیست؛ کل Visual Hierarchy و Interaction Model باید اصلاح شود.

## بدهی طراحی فعلی

مشکل‌های اصلی UI فعلی:

- زبان بصری Default مربوط به Chakra تقریباً در تمام محصول قابل تشخیص است.
- تعداد زیاد Cardهای هم‌وزن باعث شده Visual Hierarchy ضعیف باشد.
- Gaugeهای بزرگ فضای زیادی می‌گیرند ولی به تصمیم‌گیری Operator کمک متناسبی نمی‌کنند.
- Navigation بیشتر شبیه مجموعه Button است تا Application Shell حرفه‌ای.
- Problemهای عملیاتی در نگاه اول اولویت بصری ندارند.
- Status Colorها Component-level هستند و Semantic System واحد ندارند.
- Typography بین Page Title، Section Title، KPI، Label، Metadata و Identifier تمایز کافی ندارد.
- Dashboard Customization با Operational Hierarchy رقابت می‌کند.
- Workspaceهای مختلف قابل استفاده‌اند ولی هنوز حس یک Product واحد و منسجم ندارند.
- Stateهای Loading، Stale، Empty، Disconnected، Degraded و Critical زبان بصری واحد ندارند.
- Product هنوز Visual Identity مشخصی ندارد.

## جهت طراحی

جهت کاری Task 51:

**Modern NOC / Operations Console**

ظاهر باید Technical، مدرن، حرفه‌ای، High-contrast و مناسب استفاده طولانی‌مدت باشد، ولی نباید Neon-heavy، Cyberpunk یا شبیه Dashboardهای Gaming شود.

همچنین نباید شبیه Generic Admin Template، SaaS Landing Page یا مجموعه‌ای از KPI Cardهای بزرگ باشد.

## Information Architecture اصلی

### Global Shell

1. Sidebar ثابت
   - Overview
   - Telephony
   - History
   - Alerts
   - Infrastructure
   - Settings
2. Top Command/Status Bar
   - PBX یا Fleet Scope
   - Global Search
   - Realtime Connection
   - Active Issue Count
   - Language
   - Account
3. Page Header
   - عنوان
   - توضیح کوتاه عملیاتی
   - فقط Actionهای مرتبط با همان Page

### ترتیب اطلاعات در Overview

First Viewport باید به ترتیب جواب دهد:

1. آیا Scope انتخاب‌شده سالم است؟
2. الان چه چیزی مشکل دارد؟
3. Load لحظه‌ای Telephony چقدر است؟
4. Trunk، Endpoint و Queue سالم هستند؟
5. Infrastructure سالم است؟
6. Source یا Data Stale/Disconnected داریم؟

Overview باید Problem-first باشد، نه Widget-first.

## زبان بصری

### Color Roles

Color باید Semantic باشد:

- Canvas: Dark Slate نزدیک به مشکی در Dark Mode و Neutral نرم در Light Mode.
- Surface 1: Panel اصلی.
- Surface 2: Panel داخلی یا Raised.
- Border Subtle: Divider و Structure.
- Text Primary: متن عملیاتی High-contrast.
- Text Secondary: Metadata.
- Accent: یک Accent محدود برای Navigation و Action.
- Healthy: Green.
- Warning/Degraded: Amber.
- Critical: Red.
- Stale/Unknown: Slate/Neutral.
- Informational: Cyan/Blue.

Healthy State نباید کل صفحه را سبز کند؛ Color فقط برای معنی Status استفاده می‌شود.

### Surface

- تعداد Box/Card کم شود.
- Sectionهای بزرگ‌تر با Internal Divider جایگزین Cardهای ریز متعدد شوند.
- Elevation بیشتر برای Menu، Dialog، Drawer و Overlay باشد.
- Borderها ظریف و Structure-oriented باشند.

### Typography

Style جدا برای:

- Page Title
- Section Title
- KPI
- Label
- Body
- Metadata
- Mono Identifier

Identifier، Extension، Call ID و Tokenهای Technical در صورت نیاز Mono و همیشه LTR باقی می‌مانند.

### Density

- Grid دسکتاپ مبتنی بر Rhythm چهار/هشت پیکسل.
- Table و Live Entity Rowها Compact باشند.
- Outer Page Spacing بازتر و Data Spacing داخلی فشرده‌تر باشد.
- فضای خالی صرفاً تزئینی حذف شود.

## Componentهای لازم در Master Mockup

Task 51 حداقل باید این موارد را مشخص کند:

- Application Sidebar
- Top Status/Command Bar
- PBX/Fleet Selector
- Page Header
- Health Summary
- Incident/Problem List
- KPI Strip
- Live Telephony Summary
- Trunk/Endpoint/Queue Status Rows
- Infrastructure Health
- Compact Trend Chart
- Search/Filter Bar
- Dense Data Table
- Status Badge/Chip
- Empty/Loading/Stale/Error State
- Detail Drawer یا Side Panel

## اصول Interaction

- در هر View فقط یک Primary Action.
- Navigation به شکل ردیف Buttonهای مشابه نباشد.
- Live Update باعث Layout Jump نشود.
- Realtime Connection و Freshness همیشه قابل مشاهده ولی در حالت Healthy کم‌مزاحمت باشند.
- Drill-down Context را حفظ کند و در صورت مناسب بودن از Side Panel/Drawer استفاده شود.
- Actionهای Configuration و خطرناک در Settings بمانند.
- Dashboard Editing یک Secondary Mode باشد، نه تجربه پیش‌فرض Operator.

## RTL/LTR

- Chrome و متن فارسی RTL.
- Identifierهای Technical LTR.
- Table می‌تواند در UI فارسی Column Order راست‌به‌چپ داشته باشد ولی Valueهای Technical داخل Cell لزوماً LTR بمانند.
- Metricهای عددی در هر دو زبان Stable باشند.
- Mirror شدن نباید معنی Chart یا Time Axis را برعکس کند.

## هندسه Desktop

Master Mockup اولیه:

- Canvas: 1440px
- Sidebar: حدود 224 تا 248px
- Top Bar: حدود 56 تا 64px
- Content Width: Fluid
- Grid: 12 Column
- Outer Gutter: 24px
- First Viewport صفحه Overview روی Display با ارتفاع حدود 900px تا حد ممکن بدون Scroll دیده شود.

## Acceptance Criteria مربوط به Task 51

Task 51 فقط وقتی Complete است که:

- Design Debt فعلی مستقیماً در تصمیم‌های Redesign پاسخ داده شده باشد.
- Global Shell و Information Hierarchy صفحه Overview Freeze شده باشد.
- Design Token و Typography Hierarchy Freeze شده باشند.
- Desktop Overview Master Mockup از Visual QA عبور کرده باشد.
- هیچ Capability مهم فعلی در طراحی گم نشده باشد.
- Persian/English Direction در طراحی دیده شده باشد.
- Backend یا رفتار PBX تغییر نکرده باشد.
- قبل از Approval Master Mockup، Implementation اصلی شروع نشده باشد.

## Non-goalهای Task 51

- Refactor کردن Production Chakra UI
- Backend API Change
- Collector جدید
- Call Quality Implementation
- Alert Engine Implementation
- حذف Production UI فعلی قبل از تأیید Mockup

</div>
