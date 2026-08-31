-- Arregla el inicio de sesión con nombre de usuario.
--
-- La versión anterior comparaba `p.username::text = lower(uname)`. El cast a
-- `text` descarta la colación insensible a mayúsculas de `citext`, así que la
-- igualdad pasaba a ser sensible a mayúsculas contra un valor ya minusculizado:
-- solo entraban las cuentas cuyo nombre estuviera guardado todo en minúsculas.
--
-- Tampoco vale con comparar como `citext` a secas: la función corre con
-- `search_path = ''` por seguridad, y así el operador `=` de citext (que vive en
-- `public`) no es visible, con lo que Postgres vuelve a caer en una comparación
-- de texto sensible a mayúsculas. Por eso se minusculizan los dos lados de forma
-- explícita: no depende de qué operador resuelva el planificador.
--
-- El constraint `username_format` limita los nombres a [A-Za-z0-9_], así que
-- `lower()` equivale exactamente a la igualdad de citext para estos valores.
create or replace function public.email_for_login(uname text, pw text)
returns text language sql security definer stable set search_path = '' as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username::text) = lower(btrim(uname))
    and u.encrypted_password is not null
    and u.encrypted_password = extensions.crypt(pw, u.encrypted_password)
  limit 1;
$$;

revoke all on function public.email_for_login(text, text) from public;
grant execute on function public.email_for_login(text, text) to anon, authenticated;
