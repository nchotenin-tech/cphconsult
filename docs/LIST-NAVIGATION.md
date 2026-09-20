# List navigation batch

The read UI supports 5, 20 (default), or 50 cases per page, previous/next/first-page navigation, and a current-page row count. The count is not a database total. Cursor history stays in component memory; returning from detail preserves the page, while changing a submitted search, filter or page size resets to page one. Reloading the whole browser resets the view. Concurrent data changes may change page contents; no snapshot pagination guarantee is claimed.

Clear search only preserves filters. Clear search and all filters resets search/status/workflow/progress and cursor history while preserving page size. Empty filtered results suggest clearing filters; an empty later page suggests returning to page one. Tab titles now distinguish list and detail, without patient names.

Validation on the running synthetic demo: five rows on page one and one on page two; detail return preserves page two; Previous restores five rows; changing workflow on page two resets the cursor and returns two Refer cases; unmatched search shows guidance; clear-all and page size 20 restore six cases. List/detail tab titles were observed. Build and 28 existing tests passed. No API, SQL migration, or production data changes were required.
