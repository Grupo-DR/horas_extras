# IAM Rules & Policies

## Overview
Unified Identity & Access Management for Commercial and Human Capital modules.
Source of Truth: `user_profiles/{uid}` in Firestore.

## Roles & Permissions

### Commercial Module
- **COMMERCIAL_ADMIN**: Full access to Commercial module features.
- **COMMERCIAL_VIEWER**: Read-only access to Commercial dashboards.
- **IAM_ADMIN**: Cannot access Commercial business logic, but manages user profiles.

### Human Capital Module (HC)
| Role | Access Scope | Can Plan? | Manage Profiles? | Description |
| :--- | :--- | :---: | :---: | :--- |
| `HC_ADMIN` | ALL | ✅ | ✅ | Full Admin |
| `HC_MANAGER` | REGIONAL | ✅ | ❌ | Regional Manager |
| `HC_COSTCENTER_PLANNER` | COST_CENTER | ✅ | ❌ | Specific Project/CC Planner |
| `HC_AUDITOR_VIEWER` | ALL | ❌ | ❌ | Auditor / Payroll Viewer |

## Scopes
- **ALL**: Full visibility.
- **REGIONAL**: Filter data by `regionals` array in profile.
- **COST_CENTER**: Filter data by `costCenters` array in profile.

## Profile Management Policy
- Only `isSuperAdmin` (Hardcoded/Dev) or `HC_ADMIN` (or `IAM_ADMIN`) can edit profiles.
- Profiles are created automatically on first login if not present, but with minimal/no access (disabled modules).
- **Exception**: `antonio.silva@grupodr.com.br` (and Dev) are auto-initialized as Super Admins.

## Database Rules
- `read`: Own profile OR Admin.
- `write`: Admin only.
- Validation: Enforce schema types for Scope and Role.

## Migration / Fallback Strategy (Fase 1)
For existing users without a full profile structure:
1. If `modules.commercial` is undefined: Assume `{ enabled: true, role: 'COMMERCIAL_ADMIN' }`.
2. This ensures no disruption for legacy Commercial users.
3. HC access is strictly denied if `modules.human_capital.enabled` is missing or false.
