# Apple-Style Dark Mode Redesign

Pure Tailwind CSS refinement of Muscat's UI. Dark mode only, clean and minimal like Apple Reminders, with an indigo accent and adaptive navigation.

## Color System

| Token | Value | Tailwind | Purpose |
|-------|-------|----------|---------|
| Background | #0a0a0a | neutral-950 | Page background |
| Surface | #171717 | neutral-900 | Sidebar, cards |
| Elevated | #262626 | neutral-800 | Inputs, hover states |
| Border | #262626 | neutral-800 | Dividers |
| Text primary | #fafafa | neutral-50 | Headings, body |
| Text secondary | #a3a3a3 | neutral-400 | Subtitles, metadata |
| Text tertiary | #737373 | neutral-500 | Placeholders |
| Accent | #6366f1 | indigo-500 | Primary actions, focus |
| Accent hover | #818cf8 | indigo-400 | Button hover |
| Danger | #f87171 | red-400 | Overdue, destructive |
| Warning | #fbbf24 | amber-400 | Due today |
| Success | #10b981 | emerald-500 | Activate action |

## Typography

System font stack via Tailwind `font-sans` (SF Pro on Apple, Segoe on Windows). Favor `font-medium` for body, `font-semibold` for headings. No custom fonts needed.

## Layout

### Desktop (lg+)
- Fixed sidebar 240px, full height, `bg-neutral-900`
- App title top, NL input bar below, then nav links
- Active nav item: `bg-neutral-800 rounded-xl text-neutral-50`
- Inactive: `text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800/50`
- Main content: `p-8`, centered `max-w-3xl` for readability

### Mobile (<lg)
- Bottom tab bar replaces sidebar entirely — no hamburger menu
- 4 tabs (Inbox, Active, Archived, Settings) with icon + label
- Active tab: `text-indigo-500`, inactive: `text-neutral-500`
- NL input bar moves to top of main content
- Main content: `p-4 pb-20` (padding for bottom tabs)

## Components

### Task Rows
- Flat list with `border-b border-neutral-800` dividers
- Row padding: `py-3.5 px-4`
- Checkbox: 20px hollow circle, `border-neutral-600`, hover `border-indigo-400`
- Archived: filled circle `bg-neutral-700` with checkmark
- Title: `text-sm font-medium text-neutral-50`
- Tags: `rounded-full px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs`
- Due dates: right-aligned `text-xs font-medium`, color-coded
- Edit: `opacity-0 group-hover:opacity-100` on hover
- Swipe backgrounds: `red-500/10` and `emerald-500/10`

### Search Bar
- Borderless: `rounded-xl bg-neutral-800/50 border-0`
- Focus: `ring-2 ring-indigo-500/30`
- Icon and placeholder in `neutral-500`

### NL Input Bar
- Same borderless style as search: `rounded-xl bg-neutral-800/50`
- Mic: `text-neutral-500 hover:text-indigo-400`
- Focus: `ring-2 ring-indigo-500/30`

### Task Modal
- Large radius: `rounded-2xl`
- Backdrop: `bg-black/40 backdrop-blur-sm`
- Surface: `bg-neutral-900 border border-neutral-800`
- Inputs: `rounded-xl bg-neutral-800 border-0`, focus `ring-2 ring-indigo-500/30`
- Primary button: `bg-indigo-500 hover:bg-indigo-400 rounded-xl`
- Padding: `p-6`, spacing: `space-y-4`

### Login Page
- Centered, app name `text-3xl font-semibold`
- Subtitle `text-neutral-400`
- Button: `bg-white text-neutral-900 rounded-xl font-medium px-8 py-3 shadow-sm`

### Settings View
- Grouped sections in `rounded-2xl bg-neutral-900 border border-neutral-800` containers (iOS Settings style)

## Files to Modify

1. `frontend/src/assets/main.css` — add Tailwind theme overrides if needed
2. `frontend/src/components/AppLayout.vue` — layout restructure, bottom tab bar
3. `frontend/src/components/Sidebar.vue` — restyle nav items, spacing
4. `frontend/src/components/TaskRow.vue` — new row styling, refined checkbox
5. `frontend/src/components/SearchBar.vue` — borderless input style
6. `frontend/src/components/NLInputBar.vue` — borderless input style
7. `frontend/src/components/TaskModal.vue` — rounded modal, refined form inputs
8. `frontend/src/components/TagSelect.vue` — pill-style tags
9. `frontend/src/components/RecurrencePicker.vue` — match input styling
10. `frontend/src/components/AttachmentList.vue` — match styling
11. `frontend/src/components/TaskList.vue` — spacing adjustments
12. `frontend/src/views/LoginView.vue` — refined login page
13. `frontend/src/views/InboxView.vue` — heading/button restyle
14. `frontend/src/views/ActiveView.vue` — heading/button restyle
15. `frontend/src/views/ArchivedView.vue` — heading restyle
16. `frontend/src/views/SettingsView.vue` — grouped card sections
17. `frontend/src/views/ShareTargetView.vue` — match styling
18. `frontend/index.html` — update theme-color meta tag
