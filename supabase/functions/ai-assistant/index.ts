import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const mode = context?.mode || 'chat';
    
    let systemPrompt = `Tu es un assistant IA intégré au WMS Speed E-Log. 
Tu as accès à toutes les données de l'application et tu peux aider les utilisateurs à :
- Consulter des statistiques et des rapports
- Rechercher des informations sur les commandes, produits, stocks
- Suggérer des optimisations logistiques
- Répondre aux questions sur les processus WMS

Contexte actuel de l'application : ${JSON.stringify(context || {})}

Réponds de manière concise et professionnelle en français.`;

    if (mode === 'insights') {
      systemPrompt = `Analyse les données suivantes et génère exactement 3 insights courts (1 ligne max chacun), sans numérotation, séparés par des sauts de ligne. Sois direct et factuel. Données: ${JSON.stringify(context?.stats || {})}`;
    } else if (context?.capabilities) {
      systemPrompt += `\n\nTu peux suggérer des actions concrètes comme créer des commandes ou modifier des stocks. Si l'utilisateur demande une action, réponds avec du texte normal ET un objet JSON "suggestedActions" avec type, label et data.`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Error in ai-assistant:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
