# IAM Rules & Policies

## Overview
Unified Identity & Access Management for Commercial and Human Capital modules.
Source of truth: `user_profiles/{uid}` in Firestore.

## Roles & Permissions

### Commercial Module
- `COMMERCIAL_ADMIN`: full access to Commercial module features.
- `COMMERCIAL_VIEWER`: read-only access to Commercial dashboards.
- `IAM_ADMIN`: manages user profiles; does not imply Commercial business access.

### Human Capital Module (CH)
| Role | Access Scope | Can Plan? | Manage Profiles? | Description |
| :--- | :--- | :---: | :---: | :--- |
| `CH_ADMIN` | ALL | yes | yes | Full admin |
| `CH_MANAGER` | REGIONAL | yes | no | Regional manager |
| `CH_COSTCENTER_PLANNER` | COST_CENTER | yes | no | Specific project/CC planner |
| `CH_APPROVER` | ALL | yes | no | Approval workflow |
| `CH_AUDITOR_VIEWER` | ALL | no | no | Auditor / payroll viewer |

Legacy `HC_*` role values are accepted only as temporary compatibility for old `user_profiles` documents. New code and new documents must use `CH_*`.

## Scopes
- `ALL`: full visibility.
- `REGIONAL`: filter data by `regionals` array in profile.
- `COST_CENTER`: filter data by `costCenters` array in profile.

## Profile Management Policy
- Only `isSuperAdmin`, `CH_ADMIN`, or `IAM_ADMIN` can edit profiles.
- Profiles are created automatically on first login if not present, with disabled modules for regular users.

## Database Rules
- `read`: own profile or admin.
- `write`: admin only.
- Human Capital collections must check authenticated user, enabled `human_capital` module, role, and scope whenever the document has the required denormalized fields.

## Migration / Fallback Strategy
1. If `modules.commercial` is undefined, legacy Commercial users may be handled by application compatibility logic.
2. Human Capital access is denied if `modules.human_capital.enabled` is missing or false.
3. Legacy `HC_*` roles should be normalized to `CH_*` during profile reads and future profile saves.
