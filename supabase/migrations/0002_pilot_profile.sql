-- Pilot profile page: photo, position, employer and a short presentation.
alter table public.pilots
  add column if not exists photo_data_url text,
  add column if not exists rank text,
  add column if not exists employer text,
  add column if not exists nationality text,
  add column if not exists phone text,
  add column if not exists bio text;

-- A profile photo is a small JPEG (resized on the device), never a large file
alter table public.pilots
  add constraint pilots_photo_size check (photo_data_url is null or length(photo_data_url) < 400000);
