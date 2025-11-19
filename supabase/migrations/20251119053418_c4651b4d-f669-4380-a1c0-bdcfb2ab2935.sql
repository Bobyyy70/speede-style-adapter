-- Fix function search_path for security definer functions
-- This prevents search path manipulation attacks

ALTER FUNCTION acquire_sync_lock(p_lock_key text, p_owner text, p_ttl_minutes integer) SET search_path = public;
ALTER FUNCTION auto_complete_commande_fields() SET search_path = public;
ALTER FUNCTION capturer_changement_manuel_transporteur() SET search_path = public;
ALTER FUNCTION check_unanimite_suggestion(p_suggestion_id uuid) SET search_path = public;
ALTER FUNCTION creer_notification(p_user_ids uuid[], p_type character varying, p_severite character varying, p_titre character varying, p_message text, p_lien_action character varying, p_metadata jsonb) SET search_path = public;
ALTER FUNCTION current_client_id() SET search_path = public;
ALTER FUNCTION refresh_materialized_views() SET search_path = public;
ALTER FUNCTION release_sync_lock(p_lock_key text, p_owner text) SET search_path = public;
ALTER FUNCTION rollback_transition(p_type text, p_transition_id uuid, p_raison text, p_user_id uuid) SET search_path = public;
ALTER FUNCTION trigger_auto_selection_transporteur() SET search_path = public;