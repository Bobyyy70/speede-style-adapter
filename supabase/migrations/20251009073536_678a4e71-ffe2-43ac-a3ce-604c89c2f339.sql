-- Permettre aux clients de créer des profils pour leur propre client_id
CREATE POLICY "Client can insert profiles for own client"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role)
    AND client_id IN (
      SELECT client_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.can_client_create_user(client_id)
      WHERE can_client_create_user = true
    )
  );

-- Permettre aux clients d'assigner le rôle 'client' aux nouveaux utilisateurs de leur entreprise
CREATE POLICY "Client can assign client role"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'client'::app_role)
    AND role = 'client'::app_role
    AND user_id IN (
      SELECT id 
      FROM public.profiles 
      WHERE client_id IN (
        SELECT client_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );

-- Permettre aux clients de lire les rôles des utilisateurs de leur entreprise
CREATE POLICY "Client can read own company user roles"
  ON public.user_roles
  FOR SELECT
  USING (
    has_role(auth.uid(), 'client'::app_role)
    AND user_id IN (
      SELECT id 
      FROM public.profiles 
      WHERE client_id IN (
        SELECT client_id 
        FROM public.profiles 
        WHERE id = auth.uid()
      )
    )
  );