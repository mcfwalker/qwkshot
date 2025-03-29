-- Create or replace the function
create or replace function update_model_name(model_id uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if the model exists and belongs to the current user
  if not exists (
    select 1 
    from models 
    where id = model_id 
    and user_id = auth.uid()
  ) then
    raise exception 'Model not found or unauthorized';
  end if;

  -- Update the model name
  update models
  set name = new_name
  where id = model_id
  and user_id = auth.uid();
end;
$$; 