-- Recréer la vue avec SECURITY INVOKER pour que les RLS policies des tables sous-jacentes s'appliquent
DROP VIEW IF EXISTS public.users_overview;

CREATE VIEW public.users_overview
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.email,
  p.nom_complet,
  p.client_id,
  c.nom_entreprise AS client_nom,
  public.get_user_role(p.id) AS role
FROM public.profiles p
LEFT JOIN public.client c ON c.id = p.client_id;