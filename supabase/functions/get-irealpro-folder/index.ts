
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

    // 🚀 FILE D'ATTENTE DYNAMIQUE POUR UN SCAN RÉCURSIF PROFOND ET INFINI
    // Chaque élément stocke l'ID du dossier à scanner et son chemin d'arborescence calculé
    const queueFolders = [{ id: rootFolderId, currentPath: "Racine" }];

    // Tant que la file d'attente contient des dossiers à explorer
    while (queueFolders.length > 0) {
      // On extrait le premier dossier de la liste
      const currentFolder = queueFolders.shift();
      if (!currentFolder) break;

      // 1. APPEL OFFICIEL API GOOGLE DRIVE V3 : Scan unitaire du dossier en cours
      const googleApiUrl = new URL("https://www.googleapis.com/drive/v3/files");
      const queryFilter = `'${currentFolder.id}' in parents and trashed = false`;
      
      googleApiUrl.searchParams.set("q", queryFilter);
      googleApiUrl.searchParams.set("fields", "files(id, name, mimeType)");
      googleApiUrl.searchParams.set("pageSize", "1000");
      googleApiUrl.searchParams.set("key", apiKey.trim());

      const response = await fetch(googleApiUrl.toString());
      if (!response.ok) {
        console.error(`Impossible de scanner le dossier : ${currentFolder.currentPath}`);
        continue;
      }

      const data = await response.json();
      const items = data.files || [];

      // 2. ANALYSE DU CONTENU REÇU
      for (const item of items) {
        // Cas A : C'est un sous-dossier ➔ On l'ajoute à la file d'attente pour le scanner plus tard !
        if (item.mimeType === "application/vnd.google-apps.folder") {
          // On construit son chemin d'accès textuel (ex: "Exercices / Technique")
          const newPath = currentFolder.currentPath === "Racine" 
            ? item.name 
            : currentFolder.currentPath + " / " + item.name;

          queueFolders.push({ id: item.id, currentPath: newPath });
        } 
        // Cas B : C'est un morceau iRealPro .html ➔ On capture ses informations
        else if (item.name && item.name.toLowerCase().includes(".html")) {
          extractedFiles.push({
            id: item.id,
            name: item.name,
            folder_name: currentFolder.currentPath // Stocke l'arborescence complète !
          });
        }
      }
    }

    // Tri alphabétique final (A-Z) de l'ensemble de votre répertoire
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
