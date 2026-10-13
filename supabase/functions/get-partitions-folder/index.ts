
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
    const extractedFiles: Array<{ id: string, name: string, type: "PDF" | "MusicXML", folder_name: string }> = [];

    // 🚀 FILE D'ATTENTE DYNAMIQUE POUR LE SCAN RÉCURSIF PROFOND
    const queueFolders = [{ id: rootFolderId, currentPath: "Racine" }];

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

      // 🔎 REMPLACEZ LA BOUCLE DE TRI DES FICHIERS (VERS LA LIGNE 48) :
      for (const item of items) {
        const nameLower = item.name ? item.name.toLowerCase() : "";

        // Cas A : C'est un sous-dossier ➔ On l'ajoute à la file d'exploration
        if (item.mimeType === "application/vnd.google-apps.folder") {
          const newPath = currentFolder.currentPath === "Racine" 
            ? item.name 
            : currentFolder.currentPath + " / " + item.name;

          queueFolders.push({ id: item.id, currentPath: newPath });
        } 
        // Cas B : C'est une partition PDF
        else if (nameLower.endsWith(".pdf")) {
          extractedFiles.push({
            id: item.id,
            name: item.name,
            type: "PDF",
            folder_name: currentFolder.currentPath
          });
        }
        // Cas C : C'est une partition MusicXML
        else if (nameLower.endsWith(".xml") || nameLower.endsWith(".musicxml")) {
          extractedFiles.push({
            id: item.id,
            name: item.name,
            type: "MusicXML",
            folder_name: currentFolder.currentPath
          });
        }
        // ✅ Cas D : C'est une grille iRealPro délocalisée !
        else if (nameLower.endsWith(".html")) {
          extractedFiles.push({
            id: item.id,
            name: item.name,
            type: "iRealPro", // Redirige le type vers la structure iRealPro
            folder_name: currentFolder.currentPath
          });
        }
      }

    }

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
