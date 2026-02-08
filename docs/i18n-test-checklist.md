# i18n Test Checklist

## Core language switch
1. Open the app in `ko`.
2. Switch to `en`.
3. Confirm all of the following update immediately:
   - `Story` section title
   - `Top 3 Tips` label
   - `Map unavailable` badge
   - hashtag chips in list/detail cards
   - story body + tips (1/2/3)

## Data fallback behavior
1. Use a place with only Korean source content.
2. Switch to `en`.
3. Confirm fallback order works:
   - target locale content if present
   - then `en`
   - then `ko`
   - then safe template text (no empty broken UI)

## Partial/missing content
1. Prepare a cardContent record where:
   - `tips` has fewer than 3 items, or empty
   - `tags` missing
2. Open place detail.
3. Confirm:
   - tips always render 1/2/3 safely
   - missing tags are replaced by generated localized tags
   - no blank/undefined labels are shown

## Locale sync
1. Change language from `ko` to `en`.
2. Reload the page.
3. Confirm selected language persists from `localStorage` key `kspotlight.lang.v1`.
