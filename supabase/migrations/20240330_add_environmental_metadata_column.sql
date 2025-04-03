-- Add environmental_metadata column to models table
alter table models
add column if not exists environmental_metadata jsonb;

-- Add comment to the column
comment on column models.environmental_metadata is 'Stores dynamic environmental metadata including lighting, camera position, and scene constraints'; 