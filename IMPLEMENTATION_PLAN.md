# i18n Implementation Plan: Multi-Language Support (Ukrainian, English, Hebrew)

## Overview

This plan covers adding full multi-language support to the WOVSDH Nails application. The project will support three languages: Ukrainian (uk), English (en), and Hebrew (he). This includes:

1. **Frontend UI translation** – All static strings, labels, placeholders on landing page, booking wizard, admin panel
2. **Database schema** – Store multi-language content for Services, Studios (name, description, schedule_text)
3. **Admin management** – Forms to create/edit Services, Studios with language-specific fields
4. **Language persistence** – User language preference stored in localStorage/cookies
5. **Language switcher** – UI selector to switch between languages

---

## Stage 1: Setup i18n Infrastructure & Create Translation Files

**Goal**: Establish the i18n foundation using a lightweight, Next.js-friendly approach (next-intl). Create the directory structure, localization configuration, and base translation files for all UI strings.

**Tech Approach**:
- Use `next-intl` library (modern, integrates cleanly with Next.js 14+ App Router)
- Create `/lib/i18n` directory with language configuration
- Create `/locales` directory with JSON translation files (uk.json, en.json, he.json)
- Extract all hardcoded strings from components (Header, Hero, Services, Studios, Footer, Booking wizard, Admin panel)
- Create shared locale context/provider for server and client components

**Success Criteria**:
- next-intl installed and configured in next.config.ts
- Three language files created with complete UI strings (Ukrainian, English, Hebrew)
- Root layout and middleware set up to detect/persist language preference
- Language switcher component created and integrated into Header

**Tests**:
- Unit test: Verify translations are loaded correctly for each language
- Integration test: Verify language switcher persists user selection
- Manual: Test that UI renders correctly in all 3 languages without missing keys

**Status**: Complete

---

## Stage 2: Extract & Translate All Frontend Strings

**Goal**: Replace all hardcoded strings in components with i18n keys. Update Header, Hero, Services, Studios, Contact, Footer, Booking Wizard, and Admin panel with translated strings.

**Components to Update**:
- `/components/landing/Header.tsx` – navigation labels, button text
- `/components/landing/Hero.tsx` – hero headline, CTA buttons
- `/components/landing/Services.tsx` – service descriptions, pricing labels
- `/components/landing/Studios.tsx` – studio names, addresses, descriptions
- `/components/landing/Contact.tsx` – contact form labels, placeholders
- `/components/landing/Footer.tsx` – footer text, links
- `/components/landing/BookingSection.tsx` – booking section title
- `/components/booking/*` – booking wizard (DatePicker, TimePicker, BookingForm, BookingSuccess)
- `/app/admin/page.tsx` – admin panel tabs, form labels, buttons, validation messages
- Email templates (`/lib/email-templates.ts`) – confirmation/cancellation emails

**Success Criteria**:
- All hardcoded strings replaced with translation keys
- Consistent key naming convention (e.g., `header.navigation.services`, `booking.form.name_label`)
- All three language files complete with same key structure
- Admin panel fully translated, including all form labels, tabs, error messages

**Tests**:
- Unit: Test that key extraction doesn't break component rendering
- Manual: Visual inspection of each component in all 3 languages

**Status**: Complete (адмін-панель: AuthGate, StatusBadges, головні вкладки перекладено; внутрішні форми ServicesTab/StudiosTab/ScheduleTab/ClientsSection будуть перекладені в Stage 5)

---

## Stage 3: Implement Multi-Language Database Schema

**Goal**: Extend the database schema to support language-specific content for Services and Studios. Add jsonb columns to store translations while maintaining backward compatibility.

**Database Changes**:
- Create migration: Add `translations` jsonb column to `services` table (stores {uk: {name, description}, en: {name, description}, he: {name, description}})
- Create migration: Add `translations` jsonb column to `studios` table (stores {uk: {name, schedule_text}, en: {name, schedule_text}, he: {name, schedule_text}})
- Create migration: Add language field to support tracking translations and defaults
- Create data migration: Populate `translations` column with existing name/description/schedule_text from English (default fallback)
- Update database functions/indexes to support querying by language

**Success Criteria**:
- Migrations run successfully without data loss
- Existing data migrated to new schema
- API queries can fetch translations for specified language
- Backward compatibility maintained (old fields still accessible)

**Tests**:
- Integration test: Insert service with multi-language translations, verify retrieval
- Integration test: Rollback migration, verify data integrity
- Manual: Query services with language filters, verify correct data returned

**Status**: Complete

---

## Stage 4: Update API Endpoints for Multi-Language Data

**Goal**: Modify API endpoints to accept and return language-specific content. Add `language` parameter to GET requests, accept multi-language payloads in POST/PUT requests.

**API Changes**:
- `GET /api/services` – add optional `language` query param (default: 'uk')
- `GET /api/admin/services` – return translations jsonb + current language
- `POST /api/admin/services` – accept `translations` object with {uk, en, he} keys
- `PUT /api/admin/services/[id]` – update specific language translations
- `GET /api/studios` – add optional `language` query param
- `GET /api/admin/studios` – return multi-language data
- `POST /api/admin/studios` – accept multi-language translations
- `PUT /api/admin/studios/[id]` – update specific language translations
- Update ServiceDTO, StudioDTO types to include translations

**Success Criteria**:
- All endpoints return language-specific data when requested
- Admin can create/update services with 3-language translations simultaneously
- Public API defaults to Ukrainian but respects language parameter
- Error messages are localized (returned in requested language)

**Tests**:
- Integration test: Create service with 3-language data, fetch with language param
- Integration test: Update service translation for single language, verify others unaffected
- API test: Verify default language fallback when language param missing

**Status**: Complete

---

## Stage 5: Implement Admin Forms with Multi-Language Fields

**Goal**: Update admin panel forms to include separate input fields for each language (Ukrainian, English, Hebrew). Add language tabs/sections so users can edit all translations in one form.

**Admin UI Changes**:
- Create `LanguageTabForm` wrapper component for multi-language editing (shows tabs: UK/EN/HE)
- Update Services management form to show 3-language fields:
  - Name field (uk/en/he)
  - Description field (uk/en/he)
  - Icon (shared)
  - Price (shared)
  - Duration (shared)
- Update Studios management form to show 3-language fields:
  - Name field (uk/en/he)
  - Schedule text field (uk/en/he)
  - Other fields (street, city, timezone) remain single-language
- Update service creation modal/form to collect translations
- Add language switcher tabs within each form section
- Sync API calls to submit/retrieve multi-language data

**Success Criteria**:
- Admin can create a service with translations for all 3 languages in one form submission
- Admin can edit individual language translations without affecting others
- Form validation works for all language fields
- API calls correctly encode/decode translations

**Tests**:
- Component test: Render multi-language form, verify all language tabs visible
- Integration test: Submit form with all 3-language data, verify API payload structure
- Manual: Create service with translations, verify all languages saved and retrievable

**Status**: Complete

---

## Stage 6: Language Preference Persistence & Switcher UI

**Goal**: Add language persistence mechanism and create intuitive language switcher UI. User language preference should survive across sessions.

**Implementation**:
- Language preference stored in localStorage + cookie (for SSR)
- Language switcher component in Header (flag icons or text, positioned top-right/bottom)
- Middleware to read language preference from cookie on each request
- Default language fallback: browser language detection → Ukrainian fallback
- Language switcher updates localStorage + cookie + re-renders with new language

**Components**:
- Create `/components/LanguageSwitcher.tsx` – dropdown or flag icons to select language
- Integrate into Header component
- Update root layout to use language from cookie on SSR

**Success Criteria**:
- User can switch language via Header switcher
- Language preference persists across browser refresh
- Correct language loads on fresh browser visit (respects browser language or saved preference)
- All pages/components respond to language changes without full page reload

**Tests**:
- Browser test: Switch language, refresh page, verify preference persists
- Manual: Set browser language to Hebrew, visit site, verify Hebrew loads
- Manual: Visit in incognito mode, verify language defaults correctly

**Status**: Complete

---

## Stage 7: Localize Email Templates & System Messages

**Goal**: Extend i18n support to email templates and system-level messages (API error messages, validation messages, booking confirmation/cancellation emails).

**Content to Translate**:
- Email templates (confirmation, cancellation) with language-specific subject/body
- API validation error messages (already in Ukrainian, add English/Hebrew)
- Booking success/failure messages
- Admin notification messages
- SMS/Telegram notification text (if applicable)

**Implementation**:
- Update `/lib/email-templates.ts` to accept language parameter
- Extract email strings to translation files
- API endpoints that return error messages should respect requested language
- Booking creation should use client's language preference for emails

**Success Criteria**:
- Email sent in correct language based on client language preference or booking context
- All validation/error messages available in 3 languages
- No hardcoded strings in email templates

**Tests**:
- Integration test: Create booking in English, verify confirmation email is in English
- Manual: Test all email scenarios in each language

**Status**: Complete

---

## Stage 8: Testing & QA (All Languages)

**Goal**: Comprehensive testing across all 3 languages to ensure feature parity and correct translations.

**Test Coverage**:
- **Landing Page**: All sections (hero, services, studios, contact, gallery, footer) render correctly in all languages
- **Booking Flow**: Complete booking wizard works in all languages
- **Admin Panel**: All CRUD operations work in all languages
- **Mobile Responsive**: Language switcher accessible and functional on mobile
- **RTL Handling**: Hebrew text renders correctly (if needed)
- **SEO Metadata**: Language-specific metadata and canonical tags (hreflang)

**Success Criteria**:
- All UI elements render without visual issues in all languages
- No translation keys left untranslated
- Booking flow completes successfully in all languages
- Admin can manage multi-language content without errors
- No console errors/warnings

**Tests**:
- E2E test: Complete booking journey in each language
- E2E test: Admin creates service with 3-language data, verifies in all languages
- Visual: Screenshot comparison for each language
- SEO: Verify hreflang tags and language detection

**Status**: Complete

---

## Stage 9: Documentation & Migration Guide

**Goal**: Document the i18n system for future developers. Create guides for adding new translations, managing multi-language content, and extending to new languages.

**Documentation**:
- `/docs/I18N_GUIDE.md` – How to use i18n in components, adding new translations
- `/docs/MULTI_LANGUAGE_CONTENT.md` – How to manage services/studios with translations
- Translation key naming conventions
- Instructions for adding new languages (process, checklist)
- Troubleshooting guide (missing keys, language not loading, etc.)

**Success Criteria**:
- New developer can add a translation key and update all 3 language files
- Process for adding 4th language documented and testable
- Common issues/FAQ documented

**Status**: Complete

---

## Implementation Sequence

**Phase A: Foundation (Stages 1-2)**
- Set up i18n infrastructure
- Extract and translate all UI strings
- Deliverable: Full website in 3 languages (UI only)

**Phase B: Data (Stages 3-4)**
- Extend database schema for multi-language content
- Update APIs to handle translations
- Deliverable: APIs return language-specific Service/Studio data

**Phase C: Admin Management (Stage 5)**
- Create multi-language admin forms
- Integrate with updated APIs
- Deliverable: Admin can create/edit multi-language services and studios

**Phase D: Polish & Documentation (Stages 6-9)**
- Language persistence and switcher UI
- Email/system message localization
- Testing across all languages
- Documentation
- Deliverable: Production-ready multi-language system

---

## Key Architecture Decisions

1. **i18n Library**: Use `next-intl` for modern Next.js integration
2. **Translation Storage**: JSON files in `/locales` directory (versioning-friendly, simple)
3. **Database Translations**: JSONB columns to allow scalability without schema changes
4. **API Design**: Language parameter on requests, translations in response objects
5. **Client State**: localStorage + cookie for language preference (SSR-safe)
6. **Email Content**: Generated dynamically based on client/booking language context

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Missing translation keys break UI | Extract strings methodically, test in all languages at each stage |
| Database migration breaks existing data | Create reversible migration, test on staging first, backup production |
| RTL (Hebrew) layout issues | Design with RTL in mind from Stage 2, test responsiveness |
| Performance with large translation files | Use code splitting for translations per language, lazy load |
| Admin form complexity | Start with MVP form structure, iterate based on feedback |
| Language not persisting across sessions | Test localStorage + cookie sync thoroughly in Stage 6 |

---

## Definition of Done (per Stage)

✅ All code changes pass linting and TypeScript checks  
✅ Unit + integration tests pass  
✅ Manual testing completed in all 3 languages  
✅ No console errors/warnings  
✅ Commit messages reference stage (e.g., "Stage 1: Setup i18n infrastructure")  
✅ IMPLEMENTATION_PLAN.md updated with status after each merge  

---

## Timeline Estimate

- **Stage 1**: 1-2 days (setup, translation file structure)
- **Stage 2**: 2-3 days (extract strings, translate UI)
- **Stage 3**: 1-2 days (database migrations)
- **Stage 4**: 1-2 days (API endpoint updates)
- **Stage 5**: 2-3 days (admin forms, complexity of multi-field editing)
- **Stage 6**: 1 day (language switcher, persistence)
- **Stage 7**: 1 day (email templates, error messages)
- **Stage 8**: 1-2 days (comprehensive QA)
- **Stage 9**: 1 day (documentation)

**Total: ~11-18 days** (varies based on complexity and iteration)

---

## Success Metrics

- [ ] All 3 languages fully functional on production
- [ ] User can book service in their preferred language
- [ ] Admin can manage multi-language content
- [ ] Language preference persists across sessions
- [ ] No translation keys missing or untranslated
- [ ] All tests passing
- [ ] Zero bugs reported in QA phase
