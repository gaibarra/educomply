# phone_country_code for WhatsApp links

This migration adds an optional `phone_country_code` (E.164, e.g. `+52`) to `public.institution_profile`.

Usage in app:
- App reads `institution_profile.phone_country_code`.
- GanttView normalizes WhatsApp numbers to E.164 using that default.
- If not present, it falls back to a heuristic (country keywords) and finally `+52`.

## Apply migration
Run this SQL in your Supabase SQL editor or via the CLI:

- File: `supabase/scripts/2025-08-13_institution_profile_phone_code.sql`

## Update value
Update the default country code as needed:

```sql
UPDATE public.institution_profile
   SET phone_country_code = '+57' -- Colombia
 WHERE id = 1;
```

