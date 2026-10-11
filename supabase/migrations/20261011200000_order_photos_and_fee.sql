-- Whimsy & Bloom: photos of finished bouquets, and the KES 75 service fee.
-- Paste this whole file into Supabase → SQL Editor → New query, then click Run. Safe to run twice.

-- A public bucket for "your order is ready" photos. Only the shop's server (service-role key)
-- uploads; anyone with a photo's link can view it, and links use random file names.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-photos', 'order-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Service fee per shipped order: KES 100 → KES 75. Fees already charged don't change.
-- (The super admin can change it any time under Settings.)
-- Bumping the version makes any save already in progress reload first, so it can't undo this.
update public.app_meta
   set data = jsonb_set(data, '{settings,serviceFee}', '75'::jsonb),
       version = version + 1,
       updated_at = now()
 where id = 1
   and data ? 'settings';
