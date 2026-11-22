create table if not exists public.learning_progress (
    user_id uuid not null references auth.users (id) on delete cascade,
    course_id text not null check (length(course_id) between 1 and 48),
    lesson_id text not null check (length(lesson_id) between 1 and 48),
    completed_at timestamptz not null default now(),
    primary key (user_id, course_id, lesson_id)
);

alter table public.learning_progress enable row level security;

drop policy if exists "Learners can read their own progress" on public.learning_progress;
create policy "Learners can read their own progress"
    on public.learning_progress for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists "Learners can add their own progress" on public.learning_progress;
create policy "Learners can add their own progress"
    on public.learning_progress for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "Learners can update their own progress" on public.learning_progress;
create policy "Learners can update their own progress"
    on public.learning_progress for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

grant select, insert, update on public.learning_progress to authenticated;