-- Portada visual para torneos y ligas (URL externa o archivo subido a Storage)
-- Bucket 'tournament-covers' y sus policies ya existen (creados por migración anterior del repo reservas)

alter table nm_tournaments add column if not exists cover_image_url text;
alter table nm_leagues add column if not exists cover_image_url text;
