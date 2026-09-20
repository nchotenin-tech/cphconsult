# Workflow filters on the scoped case list

`GET /api/v1/consults` accepts `workflow=all|refer|shared_care` and `progress=all|active|finished|cancelled`. Both default to all. A specific progress requires a specific workflow. Invalid/repeated values return 422. Filters combine with consultation status using AND, before pagination and under existing case RLS. Reset the cursor when changing filters.

Classification source: legacy `src/components/PostConsultTracking.jsx`, revision `56ba8b18ff58bfa5c58dc0b9ca555f993049298c`, `isFinishedTrackingCase` and status filter.

| Progress | Refer | Shared Care |
|---|---|---|
| active | anything except referred_back/cancelled | anything except completed/cancelled |
| finished | referred_back | completed |
| cancelled | cancelled | cancelled |

Null/unknown status therefore remains active, following the source classification. This does not authorize a clinical transition. These are filters on the general authorized case list, **not** a port of the legacy tracking page's additional `isVisible` / `canViewReferWorkflow` gates, counts or workflow controls. Those need separate review before tracking-page parity can be claimed.

The UI preserves selected filters when returning from details and resets progress to all when changing workflow. Existing six-case local demo: Refer all 2, active 1, finished 1, cancelled 0; Shared Care all 1, active 1, finished/cancelled 0 (with consultation status All). No SQL migration or reseeding is needed. Restart the API and refresh the browser.

Integration coverage uses actual runtime RLS and HTTP: both workflows, all four progress filters, pagination, null/unknown states, completed versus cancelled distinction, unrelated-account denial, combined status/workflow filters and invalid inputs. Browser validation of these new controls remains pending API restart. Previous consultation-status buttons were verified in the browser at counts 6/1/1/4, including retaining selection after detail navigation.
