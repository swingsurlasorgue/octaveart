

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rootFolderId = String(body.folderId || "").trim();

    if (!rootFolderId) {
      return new Response(JSON.stringify({ error: "L'identifiant rootFolderId est manquant." }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('YOUTUBE_API_KEY') || "";
    const extractedFiles: Array<{ id: string, name: string, folder_name: string }> = [];

    // 🚀 FILE D'ATTENTE DYNAMIQUE POUR LE SCAN AUDIO RÉCURSIF PROFOND
    const queueFolders = [{ id: rootFolderId, currentPath: "Racine" }];

    // Filtre étanche dédié uniquement aux extensions audio
    const extensionFilter = "(name contains '.mp3' or name contains '.wav' or name contains '.m4a')";

    while (queueFolders.length > 0) {
      const currentFolder = queueFolders.shift();
      if (!currentFolder) break;

      const googleApiUrl = new URL("https://www.googleapis.com/drive/v3/files");
      const queryFilter = `'${currentFolder.id}' in parents and trashed = false`;
      
      googleApiUrl.searchParams.set("q", queryFilter);
      googleApiUrl.searchParams.set("fields", "files(id, name, mimeType)");
      googleApiUrl.searchParams.set("pageSize", "1000");
      googleApiUrl.searchParams.set("key", apiKey.trim());

      const response = await fetch(googleApiUrl.toString());
      if (!response.ok) continue;

      const data = await response.json();
      const items = data.files || [];

      for (const item of items) {
        // Cas A : C'est un sous-dossier ➔ On l'ajoute à la file d'exploration avec son chemin cumulé
        if (item.mimeType === "application/vnd.google-apps.folder") {
          const newPath = currentFolder.currentPath === "Racine" 
            ? item.name 
            : currentFolder.currentPath + " / " + item.name;

          queueFolders.push({ id: item.id, currentPath: newPath });
        } 
        // Cas B : C'est un fichier audio conforme ➔ On capture ses métadonnées et son arborescence
        else if (item.name && (item.name.toLowerCase().includes(".mp3") || item.name.toLowerCase().includes(".wav") || item.name.toLowerCase().includes(".m4a"))) {
          extractedFiles.push({
            id: item.id,
            name: item.name,
            folder_name: currentFolder.currentPath // Enregistre le fil d'Ariane complet (ex: Jazz / Backing Tracks)
          });
        }
      }
    }

    extractedFiles.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ files: extractedFiles }), {
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
