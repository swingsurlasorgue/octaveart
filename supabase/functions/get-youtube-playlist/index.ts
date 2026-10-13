const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('YOUTUBE_API_KEY') || "";
    const body = await req.json().catch(() => ({}));
    
    // ✅ PASSAGE DYNAMIQUE : On récupère l'adresse pré-construite par admin.js
    const playlistId = String(body.playlistId || "").trim();
    
    // On force la construction de l'URL ici de manière ultra-sécurisée
    const urlTarget = "https://www.googleapis.com/youtube/v3/playlistItems?playlistId=" + playlistId + "&part=snippet,id&maxResults=50&key=" + apiKey.trim();

    const response = await fetch(urlTarget);
    
    // ✅ INTERCEPTION DE SÉCURITÉ : Si Google répond par une erreur HTML (ex: Code 400 ou 403)
    if (!response.ok) {
        const errorRawText = await response.text();
        console.error("Réponse brute du serveur :", errorRawText);
        
        return new Response(JSON.stringify({ 
            error: "Le serveur Google a refusé la requête. Raison technique : " + errorRawText.substring(0, 200) 
        }), {
            status: 200, // On force le statut 200 pour transmettre le texte proprement à admin.js
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Si tout va bien (Statut 200), on décode le JSON normalement
    const data = await response.json();


    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
