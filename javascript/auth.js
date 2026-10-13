// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://eghoiiyirxiaclkiowke.supabase.co"; // Votre URL unique
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaG9paXlpcnhpYWNsa2lvd2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTk0MzUsImV4cCI6MjEwNjk3NTQzNX0.P06uIHteAvYI9kuLe85dTXDyWl9Xx71URkmK1_IFPpE"; 

// Extraction et initialisation natives
const { createClient } = supabase;
const supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authContainer = document.getElementById('auth-container');
const errorBanner = document.getElementById('error-banner');

// --- 1. DESSINER LE WIDGET SELON L'ÉTAT DE CONNEXION ---
async function renderAuthWidget() {
    if (errorBanner) errorBanner.style.display = "none";

    try {
        // Récupère l'utilisateur actuellement connecté
        const { data: { user } } = await supabaseInstance.auth.getUser();

        if (user) {
            // Utilisateur connecté -> On cherche son profil pour afficher Nom et Rôle
            const { data: profile } = await supabaseInstance
                .from('profiles')
                .select('first_name, last_name, role')
                .eq('id', user.id)
                .single();

            const firstName = profile?.first_name || "Élève";
            const lastName = profile?.last_name || "";
            const roleLabel = profile?.role === 'admin' ? "Admin" : "Élève";

            authContainer.innerHTML = `
                <div class="user-badge">
                    Bonjour, <strong>${firstName} ${lastName}</strong> 
                    <span class="role-tag">[${roleLabel}]</span>
                </div>
                <button class="auth-btn logout-btn" id="nav-logout-btn">Déconnexion</button>
            `;

            // Attache l'événement sur le bouton déconnexion nouvellement créé
            document.getElementById('nav-logout-btn').addEventListener('click', handleLogout);
        } else {
            // Aucun utilisateur connecté -> Formulaire de connexion épuré + BOUTON GOOGLE INTÉGRÉ
            authContainer.innerHTML = 
                '<form id="nav-login-form" style="display: flex; flex-direction: column; gap: 8px; margin: 0;">' +
                    '<div style="display: flex; gap: 8px;">' +
                        '<input type="email" id="login-email" required placeholder="Email">' +
                        '<input type="password" id="login-password" required placeholder="Mot de passe">' +
                        '<button type="submit" class="auth-btn">Connexion</button>' +
                    '</div>' +
                    '<!-- Le bouton officiel Google pour le professeur -->' +
                    '<button type="button" id="google-login-btn" style="padding: 6px 12px; background-color: #4285F4; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px;">' +
                        'Connexion Professeur (Google)' +
                    '</button>' +
                '</form>';

            // Attache l'événement de soumission au formulaire de connexion classique
            document.getElementById('nav-login-form').addEventListener('submit', handleLogin);

            // ✅ Attache l'événement de clic sur le nouveau bouton Google
            document.getElementById('google-login-btn').addEventListener('click', handleGoogleLogin);
        }
    } catch (error) {
        console.error("Erreur de rendu du widget d'authentification :", error);
        authContainer.innerHTML = "<span>Erreur d'accès</span>";
    }
}

// --- 2. TRAITEMENT DE LA CONNEXION (LOGIN) ---
async function handleLogin(event) {
    event.preventDefault(); // Bloque le rafraîchissement de la page
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    errorBanner.style.display = "none";

    try {
        // Envoi de la demande de token password à Supabase
        const { data: authData, error: authError } = await supabaseInstance.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            errorBanner.innerText = "Identifiants incorrects. Veuillez réessayer.";
            errorBanner.style.display = "block";
            return;
        }

        // Connexion réussie -> Lecture du rôle pour redirection immédiate
        const { data: profile, error: profileError } = await supabaseInstance
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !profile) {
            errorBanner.innerText = "Erreur d'accès au profil utilisateur.";
            errorBanner.style.display = "block";
            return;
        }

        // Redirection vers le sous-dossier workspace selon le statut
        if (profile.role === 'admin') {
            window.location.href = "workspace/admin-dashboard.html";
        } else {
            window.location.href = "workspace/student-dashboard.html";
        }

    } catch (err) {
        console.error("Système de connexion en panne :", err);
        errorBanner.innerText = "Une erreur technique est survenue.";
        errorBanner.style.display = "block";
    }
}

// --- 3. TRAITEMENT DE LA DÉCONNEXION (LOGOUT) ---
async function handleLogout() {
    try {
        const { error } = await supabaseInstance.auth.signOut();
        if (error) {
            alert("Erreur lors de la déconnexion : " + error.message);
        } else {
            // Recharge le widget vide et renvoie à la racine
            await renderAuthWidget();
            window.location.href = "index.html";
        }
    } catch (err) {
        console.error(err);
    }
}

// --- CONNEXION SÉCURISÉE EN MODE TEST GOOGLE (SANS VÉRIFICATION) ---
async function handleGoogleLogin() {
    try {
        // En demandant uniquement le scope 'email', Google accepte la connexion 
        // immédiatement en mode Test, sans bloquer l'accès.
        const { error } = await supabaseInstance.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'email https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar',
                redirectTo: window.location.origin + "/workspace/admin-dashboard.html"
            }
        });

        if (error) {
            alert("Erreur de connexion Google : " + error.message);
        }
    } catch (err) {
        console.error(err);
    }
}

// --- FONCTION DE DEMANDE D'ACCÈS INCRÉMENTALE POUR GOOGLE DRIVE ---
window.requestGoogleDriveAccess = async function() {
    try {
        // Cette commande demande les droits Drive UNIQUEMENT au professeur 
        // une fois qu'il est déjà connecté et sécurisé dans son dashboard.
        await supabaseInstance.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // On demande le droit de lire les fichiers pour le streaming
                scopes: 'https://googleapis.com',
                redirectTo: window.location.href // Recharge proprement la page actuelle
            }
        });
    } catch (err) { 
        console.error("Erreur d'autorisation Drive :", err); 
    }
}



// Lancement automatique au chargement de la page
renderAuthWidget();