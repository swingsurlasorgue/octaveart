
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const body = await req.json().catch(() => ({}));
    // ✅ RECUPERATION DIRECTE DU JETON GOOGLE TRANSMIS PAR ADMIN.JS
    const googleToken = String(body.googleToken || "").trim();

    if (!googleToken) {
      return new Response(JSON.stringify({ error: "Le jeton d'authentification Google est manquant dans la requête." }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // 2. ✅ CONFIGURATION DE L'URL OFFICIELLE DES PLAYLISTS VIA L'OBJET URL SCELLÉ
    const googleApiUrl = new URL("https://youtube.googleapis.com/youtube/v3/playlists");
    
    // Filtres requis par Google : mine=true indique qu'on cible le compte de l'admin connecté
    googleApiUrl.searchParams.set("mine", "true");
    googleApiUrl.searchParams.set("part", "snippet");
    googleApiUrl.searchParams.set("maxResults", "50");

    const playlistsRes = await fetch(googleApiUrl.toString(), {
      method: 'GET',
      headers: { 'Authorization': "Bearer " + googleToken }
    });
    
    const playlistsData = await playlistsRes.json();


    if (playlistsData.error) {
      return new Response(JSON.stringify({ error: "Erreur YouTube API : " + playlistsData.error.message }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validPlaylists = (playlistsData.items || []).filter((pl: any) => {
      const title = pl.snippet?.title || "";
      return title.startsWith("Octave Art - ");
    });

    const extractedVideos: Array<{ id: string, name: string, folder_name: string }> = [];

    // 3. EXTRACTION DES VIDÉOS SÉCURISÉE
    for (const playlist of validPlaylists) {
      const cleanFolderName = playlist.snippet.title.replace("Octave Art - ", "").trim();
      const itemsUrl = `https://youtube.googleapis.com/youtube/v3/playlistItems?playlistId=${playlist.id}&part=snippet&maxResults=50`;
      
      const itemsRes = await fetch(itemsUrl, {
        headers: { 'Authorization': "Bearer " + googleToken }
      });
      if (!itemsRes.ok) continue;

      const itemsData = await itemsRes.json();
      (itemsData.items || []).forEach((item: any) => {
        const videoId = item.snippet?.resourceId?.videoId;
        const videoTitle = item.snippet?.title;
        // ✅ DEUX LIGNES COMPACTES : Extraction sécurisée de la miniature YouTube officielle
        const videoThumb = item.snippet?.thumbnails?.default?.url || `https://img.youtube.com/vi/{videoId}/default.jpg`;

        if (videoId && videoTitle && videoTitle !== "Private video" && videoTitle !== "Deleted video") {
          extractedVideos.push({
            id: videoId,
            name: videoTitle,
            folder_name: cleanFolderName,
            thumbnail: videoThumb // ✅ ON ENREGISTRE LA MINIATURE DANS SUPABASE
          });
        }
      });

    }

    return new Response(JSON.stringify({ files: extractedVideos }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
