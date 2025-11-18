#!/usr/bin/env node

/**
 * Script pour appliquer automatiquement les migrations Supabase
 * Usage: SUPABASE_SERVICE_KEY=<votre_clé> node apply-migration.js <numéro_migration>
 *
 * Exemple: SUPABASE_SERVICE_KEY=eyJhb... node apply-migration.js 20251117000006
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tggdjeoxvpzbigbikpfy.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_KEY environment variable is required');
  console.error('');
  console.error('Trouvez votre service_role key dans:');
  console.error('Supabase Dashboard > Project Settings > API > service_role key (secret)');
  console.error('');
  console.error('Usage:');
  console.error('  SUPABASE_SERVICE_KEY=eyJhb... node apply-migration.js 20251117000006');
  process.exit(1);
}

// Récupérer le numéro de migration depuis les arguments
const migrationNumber = process.argv[2];
if (!migrationNumber) {
  console.error('❌ ERROR: Migration number required');
  console.error('Usage: node apply-migration.js <migration_number>');
  console.error('Example: node apply-migration.js 20251117000006');
  process.exit(1);
}

// Construire le nom du fichier de migration
const migrationFiles = [
  `${migrationNumber}_hotfix_rls_policies_commande.sql`,
  `${migrationNumber}_fix_missing_client_id.sql`,
  `${migrationNumber}_create_sendcloud_sync_cursor.sql`,
  `${migrationNumber}_stock_automation_and_audit.sql`,
  `${migrationNumber}_cron_jobs_sendcloud.sql`,
  `${migrationNumber}_hotfix_statuts_commande.sql`,
];

let migrationPath = null;
let sqlContent = null;

for (const filename of migrationFiles) {
  try {
    const testPath = join(__dirname, 'supabase', 'migrations', filename);
    sqlContent = readFileSync(testPath, 'utf8');
    migrationPath = testPath;
    break;
  } catch (err) {
    // Fichier non trouvé, essayer le suivant
  }
}

if (!migrationPath) {
  console.error(`❌ ERROR: Migration file not found for ${migrationNumber}`);
  console.error('Searched for:');
  migrationFiles.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}

console.log(`📄 Migration file: ${migrationPath.split('/').pop()}`);
console.log(`📝 SQL length: ${sqlContent.length} characters`);
console.log('');

// Créer le client Supabase avec service_role
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔄 Applying migration...');
console.log('');

// Exécuter le SQL via RPC
try {
  // On doit exécuter le SQL directement via un appel RPC ou via l'API REST
  // Pour Supabase, on peut utiliser .rpc() avec une fonction qui exécute du SQL dynamique
  // Ou utiliser directement fetch vers l'endpoint REST

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sqlContent })
  });

  if (!response.ok) {
    // Si la méthode RPC n'existe pas, essayer une approche différente
    console.log('⚠️  Method 1 failed, trying direct SQL execution...');

    // Diviser le SQL en statements individuels
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`❌ Error executing statement: ${error.message}`);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        // Si exec_sql n'existe pas, on doit informer l'utilisateur
        if (err.message && err.message.includes('function') && err.message.includes('does not exist')) {
          console.error('');
          console.error('❌ ERROR: Cannot execute SQL directly via Supabase client');
          console.error('');
          console.error('SOLUTION 1: Utiliser la CLI Supabase');
          console.error('  1. Installer: npm install -g supabase');
          console.error('  2. Login: supabase login');
          console.error('  3. Link: supabase link --project-ref tggdjeoxvpzbigbikpfy');
          console.error('  4. Push: supabase db push');
          console.error('');
          console.error('SOLUTION 2: Utiliser le SQL Editor dans Supabase Dashboard');
          console.error('  1. Aller sur https://supabase.com/dashboard/project/tggdjeoxvpzbigbikpfy');
          console.error('  2. SQL Editor > New Query');
          console.error('  3. Copier/coller le contenu de:');
          console.error(`     ${migrationPath}`);
          console.error('  4. Run');
          process.exit(1);
        }
        throw err;
      }
    }

    console.log('');
    console.log(`✅ Migration completed: ${successCount} statements executed`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} statements failed`);
    }
  } else {
    console.log('✅ Migration applied successfully!');
  }
} catch (error) {
  console.error('❌ ERROR applying migration:');
  console.error(error.message);
  console.error('');
  console.error('ALTERNATIVE: Copy and paste SQL manually');
  console.error(`File: ${migrationPath}`);
  console.error('Dashboard: https://supabase.com/dashboard/project/tggdjeoxvpzbigbikpfy/sql');
  process.exit(1);
}
