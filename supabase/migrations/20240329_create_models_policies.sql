-- Enable RLS on models table
alter table models enable row level security;

-- Policy for selecting models (read)
create policy "Users can view their own models"
  on models
  for select
  using (auth.uid() = user_id);

-- Policy for inserting models
create policy "Users can insert their own models"
  on models
  for insert
  with check (auth.uid() = user_id);

-- Policy for updating models
create policy "Users can update their own models"
  on models
  for update
  using (auth.uid() = user_id);

-- Policy for deleting models
create policy "Users can delete their own models"
  on models
  for delete
  using (auth.uid() = user_id); 