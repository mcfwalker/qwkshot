-- Drop existing policies
drop policy if exists "Enable delete for users based on user_id" on models;
drop policy if exists "Enable insert for authenticated users" on models;
drop policy if exists "Enable read access for authenticated users" on models;
drop policy if exists "Enable update for users based on user_id" on models;

-- Recreate policies with proper conditions
create policy "Enable delete for users based on user_id"
  on models for delete
  using (auth.uid() = user_id);

create policy "Enable insert for authenticated users"
  on models for insert
  with check (auth.uid() = user_id);

create policy "Enable read access for authenticated users"
  on models for select
  using (auth.uid() = user_id);

create policy "Enable update for users based on user_id"
  on models for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id); 