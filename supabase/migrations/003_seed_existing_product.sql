-- ============================================================
-- 003 — Move the hard-coded product (data/products.ts) into the database.
-- Idempotent. Stock starts at the previously displayed value (20 total,
-- spread over 4 colours) — adjust it in Admin > Inventaire.
-- ============================================================
do $$
declare v_pid uuid; v_vid uuid; r record; n int := 0;
begin
  select id into v_pid from public.products where slug = 'paris-vintage-cap';
  if v_pid is null then
    insert into public.products (slug, name, description, price, compare_at_price, status, rating, benefits, translations,
      delivery_available, track_inventory, published_at)
    values (
      'paris-vintage-cap', 'PARIS VINTAGE CAP',
      'Casquette vintage brodée « PARIS ». Coton premium, coupe ajustable, taille universelle. Un style intemporel qui va avec tout.',
      1900, 2500, 'active', 5,
      '["Livraison 58 wilayas","Paiement à la livraison","À domicile ou Stopdesk"]'::jsonb,
      '{"ar":{"description":"قبعة عتيقة مطرّزة بكلمة « PARIS ». قطن عالي الجودة، قياس قابل للتعديل، مقاس واحد يناسب الجميع. أسلوب خالد يناسب كل الإطلالات.","benefits":["التوصيل إلى 58 ولاية","الدفع عند الاستلام","إلى المنزل أو مكتب التوصيل"]}}'::jsonb,
      true, true, now())
    returning id into v_pid;

    n := 0;
    for r in select * from (values
      ('noir','Noir','أسود','#161616'), ('bleu','Bleu','أزرق','#07228f'),
      ('rouge','Rouge','أحمر','#57120a'), ('vert','Vert','أخضر','#20742f')) as t(k, fr, ar, hex)
    loop
      insert into public.product_variants (product_id, key, name, name_ar, color_hex, stock_quantity, is_available, sort_order)
      values (v_pid, r.k, r.fr, r.ar, r.hex, 5, true, n) returning id into v_vid;
      insert into public.inventory_movements (product_id, variant_id, delta, quantity_after, reason, note)
      values (v_pid, v_vid, 5, 5, 'initial', 'Seed depuis data/products.ts');
      insert into public.product_images (product_id, variant_id, url, alt, sort_order) values
        (v_pid, v_vid, '/images/products/paris-vintage-cap/' || r.k || '-1.jpg', r.fr || ' — Paris Vintage Cap (vue 1)', n * 2),
        (v_pid, v_vid, '/images/products/paris-vintage-cap/' || r.k || '-2.jpg', r.fr || ' — Paris Vintage Cap (vue 2)', n * 2 + 1);
      n := n + 1;
    end loop;
  end if;

  -- Link historical orders to the product (matched on slug).
  update public.orders o set product_ref = v_pid where o.product_ref is null and o.product_id = 'paris-vintage-cap';
  update public.order_items i set product_ref = v_pid
    from public.orders o where i.order_id = o.id and o.product_id = 'paris-vintage-cap' and i.product_ref is null;
end $$;

insert into public.store_settings (key, value, is_public) values
  ('store.name',     '"COD Store"', true),
  ('store.currency', '{"code":"DZD","symbol_fr":"DA","symbol_ar":"دج"}', true),
  ('store.contact',  '{"phone":null,"email":null,"whatsapp":null}', true),
  ('store.social',   '{"instagram":null,"facebook":null,"tiktok":null}', true),
  ('store.announcement', '{"enabled":false,"text_fr":"","text_ar":""}', true)
on conflict (key) do nothing;

insert into public.tracking_integrations (provider, enabled, config) values
  ('meta_pixel',   false, '{"events":{"PageView":true,"ViewContent":true,"AddToCart":true,"InitiateCheckout":true,"Lead":true,"Purchase":false}}'),
  ('ga4',          false, '{"events":{"page_view":true,"view_item":true,"add_to_cart":true,"begin_checkout":true,"generate_lead":true,"purchase":false}}'),
  ('google_ads',   false, '{"conversion_label":null}'),
  ('tiktok_pixel', false, '{"events":{"ViewContent":true,"AddToCart":true,"InitiateCheckout":true,"SubmitForm":true,"CompletePayment":false}}')
on conflict (provider) do nothing;
