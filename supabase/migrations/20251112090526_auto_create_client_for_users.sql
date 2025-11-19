-- Migration: Auto-create client for new users with "client" role
-- Description: Automatically creates a client record and assigns client_id when a new user with role "client" is created
-- Date: 2025-11-12

-- Create function to auto-create client for new users
CREATE OR REPLACE FUNCTION auto_create_client_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_new_client_id UUID;
  v_email TEXT;
  v_nom_complet TEXT;
BEGIN
  -- Only process if client_id is NULL
  IF NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the user's role
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = NEW.id;

  -- If user has "client" role, create a client and assign it
  IF v_role = 'client' THEN
    -- Get user info
    v_email := NEW.email;
    v_nom_complet := NEW.nom_complet;

    -- Create a new client record
    INSERT INTO client (
      nom_entreprise,
      email_contact,
      actif,
      date_creation,
      date_modification
    )
    VALUES (
      COALESCE(v_nom_complet, v_email, 'Client Auto-créé'),
      v_email,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_new_client_id;

    -- Assign the new client_id to the profile
    NEW.client_id := v_new_client_id;

    RAISE NOTICE 'Auto-created client % for user %', v_new_client_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_create_client ON profiles;

-- Create trigger on profiles table
CREATE TRIGGER trigger_auto_create_client
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_create_client_for_new_user();

-- Also create a trigger for UPDATE in case role is assigned later
CREATE OR REPLACE FUNCTION auto_create_client_on_role_change()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_client_id UUID;
  v_new_client_id UUID;
  v_email TEXT;
  v_nom_complet TEXT;
BEGIN
  -- Only process if role changed to "client"
  IF NEW.role = 'client' AND (OLD.role IS NULL OR OLD.role != 'client') THEN
    -- Check if profile already has client_id
    SELECT client_id, email, nom_complet
    INTO v_profile_client_id, v_email, v_nom_complet
    FROM profiles
    WHERE id = NEW.user_id;

    -- If profile exists but doesn't have a client_id, create one
    IF v_profile_client_id IS NULL THEN
      -- Create a new client record
      INSERT INTO client (
        nom_entreprise,
        email_contact,
        actif,
        date_creation,
        date_modification
      )
      VALUES (
        COALESCE(v_nom_complet, v_email, 'Client Auto-créé'),
        v_email,
        true,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_new_client_id;

      -- Assign the new client_id to the profile
      UPDATE profiles
      SET client_id = v_new_client_id
      WHERE id = NEW.user_id;

      RAISE NOTICE 'Auto-created client % for existing user % after role change', v_new_client_id, NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_create_client_on_role_change ON user_roles;

-- Create trigger on user_roles table
CREATE TRIGGER trigger_auto_create_client_on_role_change
AFTER INSERT OR UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION auto_create_client_on_role_change();

-- Add comment for documentation
COMMENT ON FUNCTION auto_create_client_for_new_user() IS
'Automatically creates a client record and assigns client_id when a new user profile is created with "client" role';

COMMENT ON FUNCTION auto_create_client_on_role_change() IS
'Automatically creates a client record and assigns client_id when a user role is changed to "client"';
