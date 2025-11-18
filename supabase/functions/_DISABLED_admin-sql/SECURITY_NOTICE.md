# ⚠️ FONCTION DÉSACTIVÉE POUR RAISONS DE SÉCURITÉ

## Raison de la désactivation

Cette edge function `admin-sql` a été désactivée car elle présente un **risque de sécurité critique** :

### Problèmes identifiés :
- Permet l'exécution de SQL arbitraire avec privilèges service_role (bypass RLS)
- CORS ouvert à tous les origins (`'*'`)
- Permet DROP TABLE, TRUNCATE, DELETE sans WHERE, ALTER TABLE, etc.
- Même avec validation admin, reste un vecteur d'attaque potentiel

### Ce qui était bloqué (insuffisant) :
- DROP DATABASE, DROP SCHEMA
- GRANT, REVOKE
- CREATE/DROP USER/ROLE

### Ce qui n'était PAS bloqué (dangereux) :
- `DROP TABLE` - Suppression de tables
- `TRUNCATE` - Vidage de tables
- `DELETE FROM table` - Suppression de toutes les données
- `ALTER TABLE` - Modification de schéma
- `UPDATE` - Modification massive de données
- `INSERT` - Injection de données malveillantes

## Alternative recommandée

Si vous avez besoin d'exécuter du SQL admin :

1. **Via Supabase Dashboard** :
   - https://supabase.com/dashboard/project/YOUR_PROJECT/sql
   - Interface officielle avec logging complet

2. **Via migrations** :
   - Créer des fichiers dans `supabase/migrations/`
   - Versionné, auditable, reproductible

3. **Via RPC functions dédiées** :
   - Créer des fonctions PostgreSQL spécifiques pour chaque besoin
   - Limiter les opérations possibles
   - Exemple : `create_user_safe()`, `update_config_safe()`, etc.

## Réactivation (NON RECOMMANDÉ)

Si absolument nécessaire, renommez `_DISABLED_admin-sql` en `admin-sql` et ajoutez :

1. **Rate limiting strict** : 5 requêtes/heure max
2. **IP whitelist** : Liste blanche d'IPs autorisées
3. **Audit logging vers DB** : Log toutes les requêtes dans une table `admin_sql_audit`
4. **Validation stricte** : Liste blanche d'opérations autorisées au lieu de blocklist
5. **2FA obligatoire** : Double authentification pour les admins
6. **Alertes Slack/Email** : Notification à chaque utilisation

## Date de désactivation
2025-11-18

## Responsable
Claude Code (Audit de sécurité)
