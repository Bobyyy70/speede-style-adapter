import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [] } = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message manquant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Construire le contexte système
    const systemPrompt = `Tu es un assistant virtuel pour un système de gestion d'entrepôt (WMS).
Tu peux aider les clients avec:
- Questions sur leurs commandes
- Statut de leurs expéditions
- Retours de produits
- Problèmes de stock
- Création de tickets support

Si le problème nécessite une intervention humaine, propose de créer un ticket support.
Réponds de manière concise et professionnelle en français.`;

    // Préparer les messages pour l'API
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    // Appeler Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messages,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Trop de requêtes, veuillez réessayer dans quelques instants.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporairement indisponible.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices[0].message.content;

    // Sauvegarder la conversation
    const authHeader = req.headers.get('authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    const sessionId = crypto.randomUUID();
    
    if (userId) {
      // Sauvegarder la conversation utilisateur
      await supabase.from('conversation_service_client').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        message: message,
      });

      // Sauvegarder la réponse assistant
      await supabase.from('conversation_service_client').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        message: assistantMessage,
      });
    }

    return new Response(
      JSON.stringify({ 
        response: assistantMessage,
        session_id: sessionId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Chatbot error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
