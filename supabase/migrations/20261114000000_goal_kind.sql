-- Goal type for the Goals area (#73, #77, #78): One-time or Ongoing. A new Goal is One-time
-- (#77 AC4) and the type can be changed on the Goal detail. Existing Goals become One-time.
alter table public.goals
  add column kind text not null default 'one_time'
    check (kind in ('one_time', 'ongoing'));
