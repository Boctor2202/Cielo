-- Demo account only: gives each first-officer flight a fictional captain name (the EASA format asks for it).
-- Idempotent (only rows without a name). Not applied: run on explicit instruction.
update flights f
set pic_name = (array['Cdt A. Moreau','Cdt L. Garnier','Cdt S. Laurent','Cdt J. Petit','Cdt M. Roux'])[1 + (abs(hashtext(f.id::text)) % 5)],
    updated_at = now()
where f.pilot_id = '674a8d9d-d91b-4414-8b66-9b1e5b71e9ca'
  and f.function <> 'PIC'
  and coalesce(f.pic_name, '') = '';
