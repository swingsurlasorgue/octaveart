// CONFIGURATION DE SUPABASE
const SUPABASE_URL = "https://eghoiiyirxiaclkiowke.supabase.co"; // Votre URL unique
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaG9paXlpcnhpYWNsa2lvd2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTk0MzUsImV4cCI6MjEwNjk3NTQzNX0.P06uIHteAvYI9kuLe85dTXDyWl9Xx71URkmK1_IFPpE"; 

const { createClient } = supabase;
const supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- 1. BARRIÈRE DE SÉCURITÉ DE L'ESPACE ÉLÈVE ---
async function checkStudentSecurity() {
    try {
        const { data: { user } } = await supabaseInstance.auth.getUser();
        
        // Si aucune session utilisateur active -> redirection vers l'accueil
        if (!user) {
            window.location.href = "../index.html";
            return;
        }

        // Récupération de la fiche profil correspondante
        const { data: profile, error } = await supabaseInstance
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('id', user.id)
            .single();

        // Sécurité stricte : si pas élève, on bloque l'accès
        if (error || !profile || profile.role !== 'student') {
            alert("Accès non autorisé.");
            window.location.href = "../index.html";
            return;
        }

        // Affichage du nom de l'élève connecté dans sa barre de menu
        document.getElementById('student-name').innerText = `${profile.first_name} ${profile.last_name}`;

        // 🚀 EFFET COMPTE-GOUTTES : On va charger uniquement ses cours associés (via son user.id)
        fetchStudentAssignedResources(user.id);

    } catch (err) {
        console.error("Échec du contrôle de sécurité élève :", err);
        window.location.href = "../index.html";
    }
}

// --- 2. RÉCUPÉRATION DES SUPPORTS ATTRIBUÉS AU COMPTE-GOUTTES ---
async function fetchStudentAssignedResources(studentId) {
    const resourcesContainer = document.getElementById('resources-container');
    if (!resourcesContainer) return;
    
    try {
        // On interroge votre table de liaison existante pour cet élève précis
        // Le select('resources(*)') effectue la jointure automatique pour ramener Titre, Type, URL
        const { data: assignments, error } = await supabaseInstance
            .from('student_resources')
            .select(`
                resources (
                    id, title, type, url
                )
            `)
            .eq('student_id', studentId);

        if (error) throw error;

        // Si l'administrateur n'a encore coché aucune case pour cet élève
        if (!assignments || assignments.length === 0) {
            resourcesContainer.innerHTML = `
                <p style="color: #888; font-style: italic; padding: 15px; background: #fff; border-radius: 6px;">
                    Bonjour, aucun matériel pédagogique ou playlist n'a encore été partagé avec vous pour le moment. 
                    Votre professeur les ajoutera ici au fur et à mesure de vos leçons !
                </p>`;
            return;
        }

        resourcesContainer.innerHTML = ""; // On nettoie le message de chargement

        // On parcourt chaque cours coché pour fabriquer le design
        assignments.forEach(assign => {
            const res = assign.resources; // Extrait les colonnes de la ressource liée
            if (!res) return;

            const itemDiv = document.createElement('div');
            itemDiv.className = "resource-item";
            itemDiv.style.background = "white";
            itemDiv.style.padding = "20px";
            itemDiv.style.borderRadius = "8px";
            itemDiv.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
            itemDiv.style.marginBottom = "25px";
            itemDiv.style.borderLeft = "5px solid #2980b9";

            // 🎥 TRAITEMENT FORMAT : S'il s'agit d'un lien YouTube (Vidéo ou Playlist)
            if (res.type === 'YouTube') {
                let embedUrl = "";
                
                if (res.url.includes('list=')) {
                    // 🔹 Cas A : C'est une playlist complète
                    const urlParams = new URLSearchParams(new URL(res.url).search);
                    const playlistId = urlParams.get('list');
                    embedUrl = `https://youtube.com{playlistId}`;
                } else if (res.url.includes('v=')) {
                    // 🔹 Cas B : C'vest une vidéo seule
                    const urlParams = new URLSearchParams(new URL(res.url).search);
                    const videoId = urlParams.get('v');
                    embedUrl = `https://youtube.com{videoId}`;
                } else {
                    // Secours si l'URL est au format court mobile (youtu.be/)
                    const videoIdIdUrl = res.url.split('/').pop();
                    embedUrl = `https://youtube.com{videoIdIdUrl}`;
                }

                itemDiv.innerHTML = `
                    <h3 style="margin-top: 0; margin-bottom: 12px; color: #2c3e50; font-size: 18px;">${res.title}</h3>
                    <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <iframe 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            src="${embedUrl}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                `;
            } else {
                // 📄 🎵 TRAITEMENT FORMAT : Autres types (Partitions PDF, Fichiers Audios Drive...)
                let formatEmoji = res.type === 'PDF' ? '📄' : '🎵';
                
                itemDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin-top: 0; margin-bottom: 5px; color: #2c3e50; font-size: 18px;">${formatEmoji} ${res.title}</h3>
                            <span style="font-size: 12px; color: #7f8c8d; font-weight: bold;">Type de document : ${res.type}</span>
                        </div>
                        <a href="${res.url}" target="_blank" style="padding: 10px 20px; background: #2980b9; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; transition: background 0.2s;">
                            Ouvrir le support
                        </a>
                    </div>
                `;
            }
            resourcesContainer.appendChild(itemDiv);
        });

    } catch (err) {
        console.error("Erreur de rendu de l'espace étudiant :", err);
        resourcesContainer.innerHTML = `<p style="color: #c0392b; font-style: italic;">Erreur lors du chargement de vos supports de cours.</p>`;
    }
}

// --- 3. MODIFICATION DU MOT DE PASSE (CONSERVÉ) ---
document.getElementById('password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        alert("Les deux mots de passe ne correspondent pas.");
        return;
    }

    try {
        const { error } = await supabaseInstance.auth.updateUser({ password: newPassword });
        if (error) { alert("Erreur : " + error.message); } 
        else { alert("Votre mot de passe secret a été mis à jour avec succès !"); document.getElementById('password-form').reset(); }
    } catch (err) { console.error(err); }
});

// --- 4. ACTION DE DÉCONNEXION ---
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabaseInstance.auth.signOut();
    window.location.href = "../index.html";
});

// Initialisation au chargement de la page de l'élève
checkStudentSecurity();