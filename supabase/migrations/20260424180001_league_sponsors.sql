-- Sponsors / banners rotantes de la liga
-- Estructura: array de objetos { image_url: text, link: text|null, alt: text|null }
alter table nm_leagues
  add column if not exists sponsors_jsonb jsonb not null default '[]'::jsonb;

comment on column nm_leagues.sponsors_jsonb is
  'Array de banners/sponsors de la liga: [{image_url, link?, alt?}]. Rotan en la vista pública.';
