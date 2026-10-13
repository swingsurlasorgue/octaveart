
import * as Settings from "./settings.js";

export function auth(authContainer) {
    // private
    const supabaseClient = supabase.createClient(Settings.SUPABASE_URL, Settings.SUPABASE_ANON_KEY);
    let container = authContainer;

    if( ! container ) {
        console.error("Erreur de rendu du widget d'authentification : container is null");
        return null;
    }

    function createInnerHTML() {
        container = document.createElement("div");
        container.id = "oa-auth-container";
        container.classList.add("oa-auth-widget");

        // loading span
        const span = document.createElement("span");
        span.innerHTML = "Loading Auth widget...";
        container.appendChild(span);
    };

    // init inner HTML
    createInnerHTML();

    async function handleStudentLogin(event) {
        event.preventDefault(); // Bloque le rafraîchissement de la page
        
        const email = authContainer.querySelector('#oa-auth-login-email').value;
        const password = authContainer.querySelector('#oa-auth-login-password').value;

        try {
            // Envoi de la demande de token password à Supabase
            const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (authError) {
                alert("Identifiants incorrects. Veuillez réessayer.");
                return;
            }

            // Connexion réussie -> Lecture du rôle pour redirection immédiate
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', authData.user.id)
                .single();

            if (profileError || !profile) {
                alert("Erreur d'accès au profil utilisateur.");
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
            alert("Système de connexion en panne :" + err);
        }
    }


    async function handleTeacherLogin() {
        try {
            // En demandant uniquement le scope 'email', Google accepte la connexion 
            // immédiatement en mode Test, sans bloquer l'accès.
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: Settings.GOOGLE_AUTH_ADMIN_SCOPES.join(" "),
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

    async function handleLogout() {
        try {
            const { error } = await supabaseClient.auth.signOut();
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

    return {
        async renderAuthWidget() {
            try {
                // Récupère l'utilisateur actuellement connecté
                const { data: { user } } = await supabaseClient.auth.getUser();

                if (user) {
                    // Utilisateur connecté -> On cherche son profil pour afficher Nom et Rôle
                    const { data: profile } = await supabaseClient
                        .from('profiles')
                        .select('first_name, last_name, role')
                        .eq('id', user.id)
                        .single();

                    const firstName = profile?.first_name || "Élève";
                    const lastName = profile?.last_name || "";
                    const roleLabel = profile?.role === 'admin' ? "Admin" : "Élève";

                    authContainer.innerHTML = `
                        <div class="oa-auth-user-badge">
                            Bonjour, <strong>${firstName} ${lastName}</strong> 
                            <span class="oa-auth-role-tag">[${roleLabel}]</span>
                        </div>
                        <button class="oa-auth-btn oa-auth-logout-btn" id="oa-auth-logout-btn">Déconnexion</button>
                    `;

                    // Attache l'événement sur le bouton déconnexion nouvellement créé
                    authContainer.querySelector('oa-auth-logout-btn').addEventListener('click', handleLogout);
                } else {
                    // Aucun utilisateur connecté -> Formulaire de connexion épuré + BOUTON GOOGLE INTÉGRÉ
                    authContainer.innerHTML = 
                        '<form id="oa-auth-login-form">' +
                            '<div id="oa-auth-login-form-container">' +
                                '<input type="email" id="oa-auth-login-email" required placeholder="Email">' +
                                '<input type="password" id="oa-auth-login-password" required placeholder="Mot de passe">' +
                                '<button type="submit" class="oa-auth-connect-btn">Connexion</button>' +
                            '</div>' +
                            '<!-- Le bouton officiel Google pour le professeur -->' +
                            '<button type="button" id="oa-auth-teacher-login-btn">' +
                                'Connexion Enseignant' +
                            '</button>' +
                        '</form>';

                    // Attache l'événement de soumission au formulaire de connexion classique
                    authContainer.querySelector('#oa-auth-login-form').addEventListener('submit', handleStudentLogin);

                    // ✅ Attache l'événement de clic sur le nouveau bouton Google
                    authContainer.querySelector('#oa-auth-teacher-login-btn').addEventListener('click', handleTeacherLogin);
                }
            } catch (error) {
                console.error("Erreur de rendu du widget d'authentification :", error);
                authContainer.innerHTML = "<span>Erreur d'accès</span>";
            }
        }
    };
};
