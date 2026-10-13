// CONFIGURATION DE SUPABASE
const SUPABASE_URL = "https://eghoiiyirxiaclkiowke.supabase.co"; // Votre URL unique
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaG9paXlpcnhpYWNsa2lvd2tlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTk0MzUsImV4cCI6MjEwNjk3NTQzNX0.P06uIHteAvYI9kuLe85dTXDyWl9Xx71URkmK1_IFPpE";

// Extraction et initialisation natives depuis le script local supabase.js
const { createClient } = supabase;
const supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ FILTRE DE RECHERCHE GLOBAL UNIQUE POUR TOUT LE CATALOGUE
let RECHERCHE_FILTRE_GLOBAL = "";

// --- 1. GESTION DES ONGLETS PRINCIPAUX DE L'INTERFACE ---
window.switchTab = function(tabName) {
    const viewStudents = document.getElementById('view-students');
    const viewCatalog = document.getElementById('view-catalog');
    const viewChords = document.getElementById('view-chords');
    const viewCalendar = document.getElementById('view-calendar');
    
    const btnStudents = document.getElementById('tab-students');
    const btnCatalog = document.getElementById('tab-catalog');
    const btnChords = document.getElementById('tab-chords');
    const btnCalendar = document.getElementById('tab-calendar');


    // Masquage initial de toutes les vues
    viewStudents.style.display = "none";
    viewCatalog.style.display = "none";
    if (viewChords) viewChords.style.display = "none";
    if (viewCalendar) viewCalendar.style.display = "none";

    // Retrait des classes actives
    btnStudents.classList.remove('active');
    btnCatalog.classList.remove('active');
    if (btnChords) btnChords.classList.remove('active');
    if (btnCalendar) btnCalendar.classList.remove('active');

    // Activation de l'onglet ciblé
    if (tabName === 'students') {
        viewStudents.style.display = "block";
        btnStudents.classList.add('active');
        fetchStudents();
    } else if (tabName === 'catalog') {
        viewCatalog.style.display = "block";
        btnCatalog.classList.add('active');
        fetchResources();
    } else if (tabName === 'chords') {
        if (viewChords) viewChords.style.display = "block";
        if (btnChords) btnChords.classList.add('active');
        fetchGuitarChords(); // Charge le dictionnaire d'accords
    } else if (tabName === 'calendar') {
        if (viewCalendar) viewCalendar.style.display = "block";
        if (btnCalendar) btnCalendar.classList.add('active');
        
        // ✅ 1. ASSIGNATION DE LA DATE PAR DÉFAUT AU DERNIER JOUR DE JUIN DE L'ANNÉE DE COURS ACTIVE
        const anneeEnCours = new Date().getFullYear();
        // Si on est en fin d'année scolaire (ex: octobre 2026), la fin est en juin 2027
        const anneeCible = new Date().getMonth() >= 7 ? anneeEnCours + 1 : anneeEnCours;
        document.getElementById('event-end-recurrence-date').value = "";

        // ✅ 2. CHARGEMENT SIMULTANÉ DE LA LISTE DES ÉLÈVES ET DE L'AGENDA
        fetchStudentsForCalendarCombo();
        fetchGoogleCalendarEvents();
    }
}


// --- 2. BARRIÈRE DE SÉCURITÉ ---
async function checkAdminSecurity() {
    try {
        const { data: { user } } = await supabaseInstance.auth.getUser();
        if (!user) { window.location.href = "../index.html"; return; }

        const { data: profile, error } = await supabaseInstance
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('id', user.id)
            .single();

        if (error || !profile || profile.role !== 'admin') {
            alert("Accès refusé. Réservé à l'administrateur.");
            window.location.href = "../index.html";
            return;
        }

        document.getElementById('admin-name').innerText = `${profile.first_name} ${profile.last_name}`;
        fetchStudents(); // Charge la liste initiale au démarrage

    } catch (err) {
        console.error(err);
        window.location.href = "../index.html";
    }
}

// --- 3. GESTION DES ÉLÈVES (LISTING, INSCRIPTION NATIVE & SUPPRESSION) ---
async function fetchStudents() {
    const studentsContainer = document.getElementById('students-container');
    try {
        const { data: students } = await supabaseInstance
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('role', 'student')
            .order('last_name', { ascending: true });

        if (!students || students.length === 0) {
            studentsContainer.innerHTML = `<li style="color: #888; font-style: italic;">Aucun élève inscrit pour le moment.</li>`;
            return;
        }

        studentsContainer.innerHTML = "";
        students.forEach(student => {
            const li = document.createElement('li');
            li.className = "student-item";
            li.style.display = "flex"; li.style.justify = "space-between"; li.style.alignItems = "center";
            li.style.marginBottom = "12px"; li.style.padding = "10px"; li.style.background = "#f8f9fa";
            li.style.borderRadius = "4px"; li.style.borderLeft = "4px solid #27ae60";

            li.innerHTML = `
                <span style="margin-right: 20px;"><strong>${student.last_name.toUpperCase()}</strong> ${student.first_name}</span>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="action-btn" style="width: auto; padding: 8px 16px; font-size: 14px; background-color: #2c3e50; margin: 0;" 
                            onclick="openAccessManagement('${student.id}', '${student.first_name} ${student.last_name}')">
                        Gérer les accès
                    </button>
                    <button type="button" class="action-btn" style="width: auto; padding: 8px 12px; font-size: 14px; background-color: #c0392b; margin: 0;" 
                            onclick="deleteStudent('${student.id}', '${student.first_name} ${student.last_name}')">
                        Supprimer
                    </button>
                </div>
            `;
            studentsContainer.appendChild(li);
        });
    } catch (err) { console.error(err); }
}

// --- 3. SOUMISSION DU FORMULAIRE : INSCRIPTION ÉLÈVE (NATIVE & PUBLIQUE) ---
const studentForm = document.getElementById('student-form');
if (studentForm) {
    studentForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Empêche le rechargement de la page HTML

        const firstName = document.getElementById('stud-firstname').value;
        const lastName = document.getElementById('stud-lastname').value;
        const email = document.getElementById('stud-email').value;
        const password = document.getElementById('stud-password').value;

        try {
            // 1. Inscription publique native auprès de Supabase Auth (Clé anon_key uniquement)
            // L'option 'Confirm Email' étant désactivée sur votre interface Supabase,
            // le compte est créé à l'état validé en une fraction de seconde, sans e-mail.
            const { data: authData, error: authError } = await supabaseInstance.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        role: 'student'
                    }
                }
            });

            if (authError) {
                alert("Erreur lors de la création de l'authentification : " + authError.message);
                return;
            }

            // 2. Écriture immédiate dans la table des profils publics
            const { error: profileError } = await supabaseInstance
                .from('profiles')
                .insert([{
                    id: authData.user.id,
                    first_name: firstName,
                    last_name: lastName,
                    role: 'student',
                    email: email
                }]);

            if (profileError) {
                alert("Compte d'authentification créé, mais échec de la fiche profil : " + profileError.message);
                return;
            }

            alert(`Le compte de l'élève ${firstName} ${lastName} a été créé avec succès et est prêt à l'emploi !`);
            studentForm.reset(); // Vide le formulaire

            // Rafraîchit la liste des élèves dans la colonne de droite
            fetchStudents();

        } catch (error) {
            console.error("Erreur d'inscription système :", error);
            alert("Une erreur technique s'est produite.");
        }
    });
}

// --- 3. BIS. SUPPRESSION ÉLÈVE ET CASCADE CALENDAR INFINIE (FIX TOUS LES ÉVÉNEMENTS) ---
window.deleteStudent = async function (studentId, studentName) {
    if (!confirm(`⚠️ ATTENTION : Supprimer définitivement l'élève ${studentName} ?\n\nCette action va scanner l'INTÉGRALITÉ de votre Google Agenda futur pour supprimer ses cours individuels ou le retirer des cours collectifs.`)) return;

    try {
        // 🚀 SECTION A : NETTOYAGE CHIRURGICAL ET INFINI DU GOOGLE CALENDAR
        const { data: sessionData } = await supabaseInstance.auth.getSession();
        const googleToken = sessionData?.session?.provider_token;

        if (!googleToken) {
            alert("⚠️ Jeton Google manquant. Suppression de Supabase uniquement. Veuillez nettoyer votre Google Calendar manuellement.");
        } else {
            const dateAujourdHui = new Date().toISOString();
            let nextPageToken = "";
            let totalTraites = 0;

            // 🔄 BOUCLE DE PAGINATION UNIVERSELLE : Tourne tant que Google a des événements à fournir
            do {
                // Construction de l'URL : Pas de timeMax = Scan infini dans le futur !
                let urlCalendar = `https://www.googleapis.com/calendar/v3/calendars/d1c0a7425aef44bfd3b8e7ee1aec5592b2cbf9826dcac306c63ed4f065233f5a@group.calendar.google.com/events?` +
                                    `timeMin=${encodeURIComponent(dateAujourdHui)}&` +
                                    `singleEvents=true&` +
                                    `maxResults=250`; // Récupère le maximum autorisé par page par Google

                if (nextPageToken) {
                    urlCalendar += `&pageToken=${nextPageToken}`;
                }

                const resCal = await fetch(urlCalendar, { headers: { 'Authorization': `Bearer ${googleToken}` } });
                if (!resCal.ok) {
                    console.error("Impossible d'accéder aux pages de l'API Google Calendar.");
                    break;
                }

                const dataCal = await resCal.json();
                const nextEvents = dataCal.items || [];
                nextPageToken = dataCal.nextPageToken; // Capture le jeton de la page suivante s'il existe

                // Analyse des événements de la page en cours
                for (const event of nextEvents) {
                    const privateProps = event.extendedProperties?.private || {};
                    const rawStudentIds = privateProps.student_ids || "";
                    
                    if (rawStudentIds.includes(studentId)) {
                        let listIds = rawStudentIds.split(",").map(id => id.trim()).filter(id => id !== "");
                        totalTraites++;

                        // 🎯 CAS 1 : COURS INDIVIDUEL (L'élève est seul ou dernier sur l'événement)
                        if (listIds.length <= 1 || (listIds.length === 2 && !listIds.includes(studentId))) {
                            const idCibleSuppression = event.recurringEventId ? event.recurringEventId.split("_")[0] : event.id;
                            
                            await fetch(`https://www.googleapis.com/calendar/v3/calendars/d1c0a7425aef44bfd3b8e7ee1aec5592b2cbf9826dcac306c63ed4f065233f5a@group.calendar.google.com/events/${idCibleSuppression}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${googleToken}` }
                            });
                        } 
                        // 🎯 CAS 2 : COURS COLLECTIF (Retrait exclusif de l'élève)
                        else {
                            const listeIdsFiltree = listIds.filter(id => id !== studentId);
                            const listAttendeesFiltree = (event.attendees || []).filter(att => att.comment !== studentId);

                            const bodyUpdate = {
                                extendedProperties: {
                                    private: { "student_ids": listeIdsFiltree.join(",") }
                                },
                                attendees: listAttendeesFiltree
                            };

                            await fetch(`https://www.googleapis.com/calendar/v3/calendars/d1c0a7425aef44bfd3b8e7ee1aec5592b2cbf9826dcac306c63ed4f065233f5a@group.calendar.google.com/events/${event.id}?sendUpdates=all`, {
                                method: 'PATCH',
                                headers: { 
                                    'Authorization': `Bearer ${googleToken}`,
                                    'Content-Type': 'application/json' 
                                },
                                body: JSON.stringify(bodyUpdate)
                            });
                        }
                    }
                }
            } while (nextPageToken); // S'arrête dès que la dernière page Google a été purgée
            
            console.log(`[Octave Art] Cascade Google Calendar terminée. ${totalTraites} créneaux futurs analysés.`);
        }

        // 🚀 SECTION B : NETTOYAGE DES TABLES DANS SUPABASE
        await supabaseInstance.from('student_resources').delete().eq('student_id', studentId);
        const { error } = await supabaseInstance.from('profiles').delete().eq('id', studentId);
        
        if (error) throw error;

        alert(`🎉 L'élève a été supprimé de la base. Toute l'arborescence de ses cours présents et futurs a été nettoyée de votre Google Calendar !`);
        fetchStudents();
        
        const btnCalendar = document.getElementById('tab-calendar');
        if (btnCalendar && btnCalendar.classList.contains('active')) {
            fetchGoogleCalendarEvents();
        }

    } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression en cascade : " + err.message);
    }
}



// --- 4. GESTION DU CATALOGUE ET RENDER EN TRIPLE TREE VIEW UNIQUE ---
async function fetchResources() {
    const resourcesContainer = document.getElementById('resources-container');
    if (!resourcesContainer) return;

    try {
        // 1. Récupération en direct de toutes les lignes de la table 'resources'
        const { data: items, error } = await supabaseInstance
            .from('resources')
            .select('*')
            .order('title', { ascending: true });

        if (error) throw error;

        // Si la base est vide, on affiche le message générique
        if (!items || items.length === 0) {
            resourcesContainer.innerHTML = '<li style="color: #888; font-style: italic; padding: 10px;">Le catalogue est vide. Cliquez sur Fetch and Update pour synchroniser vos contenus.</li>';
            return;
        }

        resourcesContainer.innerHTML = ""; // Nettoie le catalogue visuel
        let compteurDossierId = 0;

         // =================================================================
        // 🎥 SECTION A : TRAITEMENT ET RENDER DU TREE VIEW YOUTUBE (ROUGE)
        // =================================================================
        // 1. Filtrage par la variable globale unique
        const listeMorceauxYouTube = items.filter(item => {
            if (item.type !== 'YouTube') return false;
            return item.title.toLowerCase().includes(RECHERCHE_FILTRE_GLOBAL.toLowerCase());
        });

        const racineArbreYT = { nom: "Racine", sousDossiers: {}, fichiers: [] };

        // 2. Boucle de construction de l'arbre logique
        listeMorceauxYouTube.forEach(item => {
            const cheminBrut = item.folder_name || "Racine";
            let dossierActuel = racineArbreYT;
            if (cheminBrut !== "Racine") {
                const segments = cheminBrut.split(" / ");
                segments.forEach(segment => {
                    const nomSegment = segment.trim();
                    if (!dossierActuel.sousDossiers[nomSegment]) {
                        dossierActuel.sousDossiers[nomSegment] = { nom: nomSegment, sousDossiers: {}, fichiers: [] };
                    }
                    dossierActuel = dossierActuel.sousDossiers[nomSegment];
                });
            }
            dossierActuel.fichiers.push(item);
        });

        // 3. Compilateur HTML récursif pour les dossiers enfants
        function genererHtmlYTTree(noeud) {
            let html = "";
            Object.keys(noeud.sousDossiers).forEach(nomSousDossier => {
                compteurDossierId++;
                const menuId = "tree-yt-menu-" + compteurDossierId;
                const arrowId = "tree-yt-arrow-" + compteurDossierId;
                const displayStyle = RECHERCHE_FILTRE_GLOBAL !== "" ? "flex" : "none";
                const arrowTransform = RECHERCHE_FILTRE_GLOBAL !== "" ? "transform: rotate(90deg);" : "";

                
                html +=
                    '<div style="margin: 8px 0; text-align: left; padding-left: 5px;">' +
                    '<div onclick="window.toggleRecursiveFolder(\'' + menuId + '\', \'' + arrowId + '\')" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; padding: 4px 0;">' +
                    '<span id="' + arrowId + '" style="display: inline-block; font-size: 10px; color: #e74c3c; transition: transform 0.2s; margin-right: 2px;' + arrowTransform + '">▶</span>' +
                    '<span style="font-size: 14px; font-weight: bold; color: #7f1d1d;">📁 ' + nomSousDossier + '</span>' +
                    '</div>' +
                    '<div id="' + menuId + '" style="display: ' + displayStyle + '; flex-direction: column; gap: 5px; padding-left: 15px; border-left: 1px dashed #fca5a5; margin-top: 4px; margin-left: 5px;">' +
                    genererHtmlYTTree(noeud.sousDossiers[nomSousDossier]) +
                    '</div>' +
                    '</div>';
            });
            noeud.fichiers.forEach(file => {
                const videoUrl = "https://youtube.com" + file.url;
                const thumbnailUrl = file.thumbnail || "https://youtube.com" + file.url + "/default.jpg";

                html +=
                    '<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #fff5f5; border-radius: 4px; border: 1px solid #fee2e2; margin-bottom: 4px; text-align: left; margin-left: 5px;">' +
                    '<div style="display: flex; align-items: center; gap: 10px;">' +
                    '<img src="' + thumbnailUrl + '" style="width: 44px; height: 33px; object-fit: cover; border-radius: 2px; border: 1px solid #fca5a5;">' +
                    '<span style="font-size: 13px; color: #991b1b; font-weight: 500;">🎥 ' + file.title + '</span>' +
                    '</div>' +
                    '<a href="' + videoUrl + '" target="_blank" style="font-size: 11px; color: #e74c3c; text-decoration: none; font-weight: bold; white-space: nowrap; margin-left: 10px;" onclick="event.stopPropagation();">Regarder la vidéo →</a>' +
                    '</div>';
            });
            return html;
        }

        // 4. Déclaration et Rendu visuel sécurisé du bandeau maître rouge
        if (items.some(i => i.type === 'YouTube')) {
            const liYTRoot = document.createElement('li');
            liYTRoot.className = "resource-item"; liYTRoot.dataset.type = "YouTube";
            liYTRoot.style.flexDirection = "column"; liYTRoot.style.alignItems = "stretch";
            liYTRoot.style.background = "white"; liYTRoot.style.padding = "15px"; liYTRoot.style.marginBottom = "12px";
            liYTRoot.style.borderRadius = "6px"; liYTRoot.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
            liYTRoot.style.borderLeft = "5px solid #e74c3c";

            liYTRoot.innerHTML = `
                <div onclick="window.toggleRecursiveFolder('root-yt-tree-container', 'root-yt-tree-arrow')" style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%; user-select: none; text-align: left;">
                    <span id="root-yt-tree-arrow" style="display: inline-block; font-size: 11px; color: #e74c3c; transition: transform 0.2s; margin-right: 4px; ${RECHERCHE_FILTRE_GLOBAL !== '' ? 'transform:rotate(90deg);' : ''}">▶</span>
                    <span style="font-size: 15px; font-weight: bold; color: #2c3e50;">🗂️ Répertoire Général des Vidéos YouTube</span>
                    <span style="font-size: 11px; color: #e74c3c; font-weight: 600; margin-left: 5px;">(${listeMorceauxYouTube.length} vidéos)</span>
                </div>
                <div id="root-yt-tree-container" style="display: ${RECHERCHE_FILTRE_GLOBAL !== '' ? 'flex' : 'none'}; flex-direction: column; gap: 5px; margin-top: 15px; padding-left: 5px;">
                    ${genererHtmlYTTree(racineArbreYT)}
                </div>`;
                
            resourcesContainer.appendChild(liYTRoot);
        }


        // =================================================================
        // 🎵 SECTION B : TRAITEMENT ET RENDER DU TREE VIEW AUDIO (VERT)
        // =================================================================
        // 1. Filtrage instantané des pistes audio en mémoire vive
        const listeMorceauxAudio = items.filter(item => {
            if (item.type !== 'Audio') return false;
            return item.title.toLowerCase().includes(RECHERCHE_FILTRE_GLOBAL.toLowerCase());
        });

        const racineArbreAudio = { nom: "Racine", sousDossiers: {}, fichiers: [] };

        // 2. Boucle de construction de l'arbre logique Audio
        listeMorceauxAudio.forEach(item => {
            const cheminBrut = item.folder_name || "Racine";
            let dossierActuel = racineArbreAudio;
            if (cheminBrut !== "Racine") {
                const segments = cheminBrut.split(" / ");
                segments.forEach(segment => {
                    const nomSegment = segment.trim();
                    if (!dossierActuel.sousDossiers[nomSegment]) {
                        dossierActuel.sousDossiers[nomSegment] = { nom: nomSegment, sousDossiers: {}, fichiers: [] };
                    }
                    dossierActuel = dossierActuel.sousDossiers[nomSegment];
                });
            }
            dossierActuel.fichiers.push(item);
        });

        function genererHtmlAudioTree(noeud) {
            let html = "";
            Object.keys(noeud.sousDossiers).forEach(nomSousDossier => {
                compteurDossierId++;
                const menuId = "tree-audio-menu-" + compteurDossierId;
                const arrowId = "tree-audio-arrow-" + compteurDossierId;
                
                // ✅ LA RECTIFICATION : Utilisation de RECHERCHE_FILTRE_GLOBAL pour piloter l'auto-ouverture
                const displayStyle = RECHERCHE_FILTRE_GLOBAL !== "" ? "flex" : "none";
                const arrowTransform = RECHERCHE_FILTRE_GLOBAL !== "" ? "transform: rotate(90deg);" : "";
                
                html +=
                    '<div style="margin: 8px 0; text-align: left; padding-left: 5px;">' +
                    '<div onclick="window.toggleRecursiveFolder(\'' + menuId + '\', \'' + arrowId + '\')" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; padding: 4px 0;">' +
                    '<span id="' + arrowId + '" style="display: inline-block; font-size: 10px; color: #27ae60; transition: transform 0.2s; margin-right: 2px;' + arrowTransform + '">▶</span>' +
                    '<span style="font-size: 14px; font-weight: bold; color: #14532d;">📁 ' + nomSousDossier + '</span>' +
                    '</div>' +
                    '<div id="' + menuId + '" style="display: ' + displayStyle + '; flex-direction: column; gap: 5px; padding-left: 15px; border-left: 1px dashed #a7f3d0; margin-top: 4px; margin-left: 5px;">' +
                    genererHtmlAudioTree(noeud.sousDossiers[nomSousDossier]) +
                    '</div>' +
                    '</div>';
            });
            noeud.fichiers.forEach(file => {
                const previewUrl = "https://google.com" + file.url + "/preview";
                html +=
                    '<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #f0fdf4; border-radius: 4px; border: 1px solid #dcfce7; margin-bottom: 4px; text-align: left; margin-left: 5px;">' +
                    '<span style="font-size: 13px; color: #166534; font-weight: 500;">🎵 ' + file.title + '</span>' +
                    '<a href="' + previewUrl + '" target="_blank" style="font-size: 11px; color: #27ae60; text-decoration: none; font-weight: bold; white-space: nowrap; margin-left: 10px;" onclick="event.stopPropagation();">Écouter la piste →</a>' +
                    '</div>';
            });
            return html;
        }


        // 4. ✅ DEÉCLARATION DU LI REEPOSITIONNÉE : On instancie l'élément AVANT de lui attribuer son HTML [1.5]
        if (items.some(i => i.type === 'Audio')) {
            const liAudioRoot = document.createElement('li');
            liAudioRoot.className = "resource-item"; liAudioRoot.dataset.type = "Audio";
            liAudioRoot.style.flexDirection = "column"; liAudioRoot.style.alignItems = "stretch";
            liAudioRoot.style.background = "white"; liAudioRoot.style.padding = "15px"; liAudioRoot.style.marginBottom = "10px";
            liAudioRoot.style.borderRadius = "6px"; liAudioRoot.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
            liAudioRoot.style.borderLeft = "5px solid #27ae60";
            
            liAudioRoot.innerHTML = `
                <div onclick="window.toggleRecursiveFolder('root-audio-tree-container', 'root-audio-tree-arrow')" style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%; user-select: none; text-align: left;">
                    <span id="root-audio-tree-arrow" style="display: inline-block; font-size: 11px; color: #27ae60; transition: transform 0.2s; margin-right: 4px; ${RECHERCHE_FILTRE_GLOBAL !== '' ? 'transform:rotate(90deg);' : ''}">▶</span>
                    <span style="font-size: 15px; font-weight: bold; color: #2c3e50;">🗂️ Répertoire Général des Pistes Audio</span>
                    <span style="font-size: 11px; color: #27ae60; font-weight: 600; margin-left: 5px;">(${listeMorceauxAudio.length} pistes)</span>
                </div>
                <div id="root-audio-tree-container" style="display: ${RECHERCHE_FILTRE_GLOBAL !== '' ? 'flex' : 'none'}; flex-direction: column; gap: 5px; margin-top: 15px; padding-left: 5px;">
                    ${genererHtmlAudioTree(racineArbreAudio)}
                </div>`;

            resourcesContainer.appendChild(liAudioRoot);
        }


        // =================================================================
        // 📄 SECTION C : REPERTOIRE CENTRALISÉ PARTITIONS & GRILLES (BLEU)
        // =================================================================
        // 1. Filtrage instantané en mémoire vive des trois formats associés
        const listePartitions = items.filter(item => {
            if (item.type !== 'PDF' && item.type !== 'MusicXML' && item.type !== 'iRealPro') return false;
            return item.title.toLowerCase().includes(RECHERCHE_FILTRE_GLOBAL.toLowerCase());
        });

        const racineArbrePartitions = { nom: "Racine", sousDossiers: {}, fichiers: [] };

        listePartitions.forEach(item => {
            const cheminBrut = item.folder_name || "Racine";
            let dossierActuel = racineArbrePartitions;

            if (cheminBrut !== "Racine") {
                const segments = cheminBrut.split(" / ");
                segments.forEach(segment => {
                    const nomSegment = segment.trim();
                    if (!dossierActuel.sousDossiers[nomSegment]) {
                        dossierActuel.sousDossiers[nomSegment] = { nom: nomSegment, sousDossiers: {}, fichiers: [] };
                    }
                    dossierActuel = dossierActuel.sousDossiers[nomSegment];
                });
            }
            dossierActuel.fichiers.push(item);
        });

        function genererHtmlPartitionsTree(noeud) {
            let html = "";
            Object.keys(noeud.sousDossiers).forEach(nomSousDossier => {
                compteurDossierId++;
                const menuId = "tree-part-menu-" + compteurDossierId;
                const arrowId = "tree-part-arrow-" + compteurDossierId;
                const displayStyle = RECHERCHE_FILTRE_GLOBAL !== "" ? "flex" : "none";
                const arrowTransform = RECHERCHE_FILTRE_GLOBAL !== "" ? "transform: rotate(90deg);" : "";
                
                html += 
                    '<div style="margin: 8px 0; text-align: left; padding-left: 5px;">' +
                        '<div onclick="window.toggleRecursiveFolder(\'' + menuId + '\', \'' + arrowId + '\')" style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; padding: 4px 0;">' +
                            '<span id="' + arrowId + '" style="display: inline-block; font-size: 10px; color: #2980b9; transition: transform 0.2s; margin-right: 2px;' + arrowTransform + '">▶</span>' +
                            '<span style="font-size: 14px; font-weight: bold; color: #075985;">📁 ' + nomSousDossier + '</span>' +
                        '</div>' +
                        '<div id="' + menuId + '" style="display: ' + displayStyle + '; flex-direction: column; gap: 5px; padding-left: 15px; border-left: 1px dashed #bae6fd; margin-top: 4px; margin-left: 5px;">' +
                            genererHtmlPartitionsTree(noeud.sousDossiers[nomSousDossier]) +
                        '</div>' +
                    '</div>';
            });

            noeud.fichiers.forEach(file => {
                const previewUrl = "https://google.com" + file.url + "/preview";
                
                // Assignation dynamique des étiquettes et des styles de couleurs par format
                let badgeFormat = "📄 [PDF]";
                let couleurTexte = "#0369a1";
                if (file.type === "MusicXML") { badgeFormat = "⚡ [MusicXML]"; couleurTexte = "#0284c7"; }
                else if (file.type === "iRealPro") { badgeFormat = "📊 [iRealPro]"; couleurTexte = "#7c3aed"; }

                html += 
                    '<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #f0f7ff; border-radius: 4px; border: 1px solid #e0f2fe; margin-bottom: 4px; text-align: left; margin-left: 5px;">' +
                        '<span style="font-size: 13px; color: ' + couleurTexte + '; font-weight: 500;">' + badgeFormat + ' ' + file.title + '</span>' +
                        '<a href="' + previewUrl + '" target="_blank" style="font-size: 11px; color: #2980b9; text-decoration: none; font-weight: bold; white-space: nowrap; margin-left: 10px;" onclick="event.stopPropagation();">Ouvrir le support →</a>' +
                    '</div>';
            });
            return html;
        }

        // Rendu permanent du bandeau maître bleu si des données globales existent
        if (items.some(i => i.type === 'PDF' || i.type === 'MusicXML' || i.type === 'iRealPro')) {
            const liPartRoot = document.createElement('li');
            liPartRoot.className = "resource-item"; liPartRoot.dataset.type = "PDF";
            liPartRoot.style.flexDirection = "column"; liPartRoot.style.alignItems = "stretch";
            liPartRoot.style.background = "white"; liPartRoot.style.padding = "15px"; liPartRoot.style.marginBottom = "10px";
            liPartRoot.style.borderRadius = "6px"; liPartRoot.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
            liPartRoot.style.borderLeft = "5px solid #2980b9";

            const displayContainer = RECHERCHE_FILTRE_GLOBAL !== "" ? "block" : "none";
            const mainArrowTransform = RECHERCHE_FILTRE_GLOBAL !== "" ? "transform: rotate(90deg);" : "";

            liPartRoot.innerHTML = `
                    <div onclick="window.toggleRecursiveFolder('root-partitions-tree-container', 'root-partitions-tree-arrow')" style="display: flex; align-items: center; gap: 8px; cursor: pointer; width: 100%; user-select: none; text-align: left;">
                        <span id="root-partitions-tree-arrow" style="display: inline-block; font-size: 11px; color: #2980b9; transition: transform 0.2s; margin-right: 4px; ${RECHERCHE_FILTRE_GLOBAL !== '' ? 'transform:rotate(90deg);' : ''}">▶</span>
                        <span style="font-size: 15px; font-weight: bold; color: #2c3e50;">🗂️ Répertoire Général des Partitions & Grilles</span>
                        <span style="font-size: 11px; color: #2980b9; font-weight: 600; margin-left: 5px;">(${listePartitions.length} supports)</span>
                    </div>
                    <div id="root-partitions-tree-container" style="display: ${RECHERCHE_FILTRE_GLOBAL !== '' ? 'flex' : 'none'}; flex-direction: column; gap: 5px; margin-top: 15px; padding-left: 5px;">
                        ${genererHtmlPartitionsTree(racineArbrePartitions)}
                    </div>`;

            resourcesContainer.appendChild(liPartRoot);
        }




    } catch (err) { console.error("Erreur de rendu global :", err); }
}




// Fonction d'animation du Tree View
window.toggleTreeFolder = function (menuId, arrowId) {
    const menu = document.getElementById(menuId);
    const arrow = document.getElementById(arrowId);
    if (!menu) return;
    const isHidden = menu.style.display === "none" || menu.style.display === "";
    menu.style.display = isHidden ? "flex" : "none";
    if (arrow) arrow.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
}


// Interrupteur visuel interne à l'onglet iReal Pro
window.toggleIRealProFormMode = function (mode) {
    const blockFile = document.getElementById('irp-block-file');
    const blockFolder = document.getElementById('irp-block-folder');
    const submitBtn = document.getElementById('btn-import-irp');

    if (mode === 'file') {
        blockFile.style.display = "grid";
        blockFolder.style.display = "none";
        submitBtn.innerText = "Enregistrer la grille";
    } else {
        blockFile.style.display = "none";
        blockFolder.style.display = "flex";
        submitBtn.innerText = "🚀 Scanner et Importer le Répertoire";
    }
}


// Fonction globale d'ouverture/fermeture des dossiers locaux calculés
window.toggleLocalFolderStructure = function (menuId, arrowId) {
    const menu = document.getElementById(menuId);
    const arrow = document.getElementById(arrowId);
    if (!menu) return;

    if (menu.style.display === "none" || menu.style.display === "") {
        menu.style.display = "block";
        if (arrow) arrow.style.transform = "rotate(90deg)";
    } else {
        menu.style.display = "none";
        if (arrow) arrow.style.transform = "rotate(0deg)";
    }
}







// --- INTERCEPTION DE CATALOGUE COMPLÈTEMENT AUTONOME (VERSION CORRIGÉE) ---
async function parseAndDisplayPlaylistEntries(playlistId, playlistTitle, container) {
    try {
        const loadingItem = document.getElementById(`loading-\${playlistId}`);
        if (loadingItem) loadingItem.remove();

        const playlistBox = document.createElement('div');
        playlistBox.style.marginTop = "8px";
        playlistBox.style.padding = "10px 12px";
        playlistBox.style.background = "#f8f9fa";
        playlistBox.style.borderRadius = "6px";
        playlistBox.style.borderLeft = "4px solid #e74c3c";

        // ✅ Utilisation stricte des accents graves (backticks ` ) pour injecter la variable playlistId
        playlistBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="text-align: left;">
                    <strong style="font-size: 14px; color: #2c3e50;">${playlistTitle}</strong> <br>
                    <span style="font-size: 11px; color: #7f8c8d; font-style: italic;">Cliquez sur l'icône de liste en haut à droite du lecteur pour voir les entrées.</span>
                </div>
                <a href="https://youtube.com{playlistId}" target="_blank" style="padding: 5px 10px; background: #e74c3c; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: bold; white-space: nowrap;">
                    Voir sur YT →
                </a>
            </div>
            <div style="position: relative; height: 100px; width: 100%; overflow: hidden; border-radius: 4px; background: #000;">
                <iframe 
                    style="position: absolute; top: -50px; left: 0; width: 100%; height: 200px; border: none;" 
                    src="https://youtube.com{playlistId}&controls=1" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>
        `;

        container.appendChild(playlistBox);

    } catch (err) {
        console.error("Erreur de rendu de la playlist :", err);
    }
}

// --- FONCTION AUXILIAIRE REVISITÉE : AFFICHAGE NATIF DE LA COUVERTURE PLAYLIST ---
async function loadYouTubePlaylistData(playlistUrl, containerId, iconId) {
    const container = document.getElementById(containerId);
    const iconContainer = document.getElementById(iconId);

    try {
        // Extraction propre de l'ID de la playlist YouTube
        const urlParams = new URLSearchParams(new URL(playlistUrl).search);
        const playlistId = urlParams.get('list');

        if (!playlistId) return;

        // 1. AFFICHAGE DE LA COUVERTURE :
        // Les serveurs YouTube génèrent automatiquement une icône de dossier pour les playlists.
        // Si besoin, nous utilisons l'emoji TV ou un design élégant.
        if (iconContainer) {
            iconContainer.innerHTML = `🎬`;
            iconContainer.style.background = "#e74c3c";
            iconContainer.style.color = "white";
            iconContainer.style.fontWeight = "bold";
        }

        // 2. DESIGN DE LA SOUS-LISTE :
        // Pour éviter les pannes des APIs tierces gratuites, nous intégrons un bouton 
        // de prévisualisation rapide qui permet au professeur de voir sa liste directement.
        if (container) {
            container.innerHTML = `
                <div style="font-size: 13px; display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 8px 12px; border-radius: 4px; border: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-weight: 500;">🎥 Playlist synchronisée en temps réel</span>
                    <a href="https://youtube.com{playlistId}" target="_blank" style="color: #2980b9; text-decoration: none; font-weight: bold; font-size: 12px;">
                        Voir les vidéos associées →
                    </a>
                </div>
            `;
        }

    } catch (err) {
        console.error("Erreur d'affichage de la playlist :", err);
        if (container) container.innerHTML = `<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Aperçu indisponible.</span>`;
    }
}

// --- 4. BIS. LOGIQUE DES ONGLET DU FORMULAIRE D'AJOUT ---
window.switchFormTypeTab = function (formatSelected) {
    // 1. Gère les styles de surbrillance des onglets du formulaire
    const tabs = document.querySelectorAll('.form-type-tab');
    tabs.forEach(t => {
        t.style.background = "#e2e8f0";
        t.style.color = "#334155";
    });

    const activeTab = document.getElementById("form-tab-" + formatSelected);
    let tabColor = "#e74c3c"; // Rouge par défaut
    if (formatSelected === 'PDF') tabColor = "#2980b9";
    else if (formatSelected === 'Audio') tabColor = "#27ae60";
    else if (formatSelected === 'iRealPro') tabColor = "#9b59b6";

    if (activeTab) {
        activeTab.style.background = tabColor;
        activeTab.style.color = "white";
    }

    // 2. Affiche le formulaire correspondant et cache les autres
    const formats = ['YouTube', 'PDF', 'Audio'];
    formats.forEach(f => {
        document.getElementById("form-add-" + f).style.display = (f === formatSelected) ? "flex" : "none";
    });
}

// --- 4. TER. ROUTAGE DES ENREGISTREMENTS ET AUTOMATISATION IREAL PRO ---
window.handleCustomFormSubmit = async function (event, formatType) {
    event.preventDefault(); // Bloque le rechargement de page d'origine

    // 🌐 CAS EXCLUSIF : FORMAT IREAL PRO (ADAPTATIF FICHIER / DOSSIER MULTI-NIVEAUX)
    if (formatType === 'iRealPro') {
        // On vérifie quel bouton radio est coché (file ou folder)
        const chosenMode = document.querySelector('input[name="irp-mode"]:checked').value;
        const submitBtn = document.getElementById('btn-import-irp');

        // MODE 1 : AJOUT D'UN SEUL MORCEAU UNIQUE
        if (chosenMode === 'file') {
            const fileTitle = document.getElementById('irp-file-title').value.trim();
            const fileUrlInput = document.getElementById('irp-file-url').value.trim();

            let cleanFileId = fileUrlInput;
            if (cleanFileId.includes("/d/")) {
                cleanFileId = cleanFileId.split("/d/").split("/")[0];
            }

            try {
                const { error } = await supabaseInstance
                    .from('resources')
                    .insert([{ title: fileTitle, type: "iRealPro", url: cleanFileId, folder_name: "Morceaux Isolés" }]);

                if (error) { alert("Erreur d'enregistrement : " + error.message); return; }
                alert("La grille iReal Pro individuelle a été ajoutée avec succès !");
                document.getElementById("form-add-iRealPro").reset();
                window.toggleIRealProFormMode('file'); // Rétablit le bouton
                fetchResources();
            } catch (err) { console.error(err); }
            return;
        }

        // MODE 2 : IMPORTATION ET DUPLICATION DE L'ARBORESCENCE DRIVE COMPLETE
        const folderUrlInput = document.getElementById('irp-folder-url').value.trim();

        let detectedFolderId = "";
        const match = folderUrlInput.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) detectedFolderId = match[1].trim();

        if (!detectedFolderId) { alert("Lien de dossier non valide."); return; }

        submitBtn.disabled = true;
        submitBtn.innerText = "⏳ Duplication de la structure Drive en cours...";

        try {
            // ✅ RÉCUPÉRATION DU VRAI JETON DE SESSION ACTIF DEPUIS LE NAVIGATEUR
            const { data: sessionData } = await supabaseInstance.auth.getSession();
            const tokenGoogleProf = sessionData?.session?.provider_token;

            if (!tokenGoogleProf) {
                alert("Jeton Google manquant. Veuillez d'abord cliquer sur le bouton 'Autoriser le Drive' pour activer vos droits de session.");
                return;
            }

            // On transmet l'ID du dossier ET le jeton Google valide de manière étanche
            const { data, error } = await supabaseInstance.functions.invoke('get-irealpro-folder', {
                body: {
                    folderId: detectedFolderId,
                    googleToken: tokenGoogleProf // ✅ PASSAGE DIRECT DU JETON SÉCURISÉ
                }
            });

            if (error || !data || data.error) {
                alert("Échec du scan : " + (data?.error || error?.message));
                return;
            }

            if (error || !data || data.error) {
                alert("Échec de la lecture : " + (data?.error || error?.message));
                return;
            }

            if (!data.files || data.files.length === 0) {
                alert("Aucun fichier .html iReal Pro n'a été détecté dans l'arborescence.");
                return;
            }

            // MAPPAGE INTELLIGENT : Chaque morceau reçoit le vrai nom de son sous-dossier Google Drive
            const lignesAInserer = data.files.map(file => {
                const cleanTitle = file.name.replace(".html", "").replace(".HTML", "");
                return {
                    title: cleanTitle,
                    type: "iRealPro",
                    url: file.id,
                    folder_name: file.folder_name // ✅ REPREND LE SENS DE VOTRE DOSSIER DRIVE EXACT !
                };
            });

            // Envoi en rafale dans la base de données
            const { error: insertError } = await supabaseInstance.from('resources').insert(lignesAInserer);

            if (insertError) {
                alert("Erreur de sauvegarde : " + insertError.message);
            } else {
                alert(`Félicitations ! Structure synchronisée. ${lignesAInserer.length} grilles ont été extraites et ordonnées selon vos sous-dossiers Google Drive !`);
                document.getElementById("form-add-iRealPro").reset();
                window.toggleIRealProFormMode('file');
            }

        } catch (err) { console.error(err); }
        finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Enregistrer dans le catalogue";
            fetchResources(); // Rafraîchit l'affichage du catalogue
        }
        return;

    }


    // 🎥 / 📄 / 🎵 CAS STANDARD : ENREGISTREMENT UNITAIRE (YouTube, PDF, Audio)
    let title = "", url = "";
    if (formatType === 'YouTube') {
        title = document.getElementById('yt-title').value; url = document.getElementById('yt-url').value;
    } else if (formatType === 'PDF') {
        title = document.getElementById('pdf-title').value; url = document.getElementById('pdf-url').value;
    } else if (formatType === 'Audio') {
        title = document.getElementById('audio-title').value; url = document.getElementById('audio-url').value;
    }

    try {
        const { error } = await supabaseInstance
            .from('resources')
            .insert([{ title: title, type: formatType, url: url, folder_name: "Général" }]);

        if (error) { alert("Erreur d'enregistrement : " + error.message); return; }

        alert("La ressource unique a été intégrée avec succès !");
        document.getElementById("form-add-" + formatType).reset();
        fetchResources();
    } catch (err) { console.error(err); }
}


// --- 5. DECONNEXION & STUBS (Version sécurisée) ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabaseInstance.auth.signOut();
        window.location.href = "../index.html";
    });
}

// --- 5. COMPTE-GOUTTES : OUVERTURE DE LA FENÊTRE DE GESTION DES ACCÈS ---
let activeStudentId = null; // Variable globale pour mémoriser l'élève en cours d'édition

window.openAccessManagement = async function (studentId, studentName) {
    activeStudentId = studentId;
    document.getElementById('modal-student-name').innerText = studentName;

    const modal = document.getElementById('access-modal');
    const container = document.getElementById('modal-checkboxes-container');

    if (!modal || !container) return;

    modal.style.display = "flex"; // Affiche la fenêtre surgissante
    container.innerHTML = "<p style='color: #888; font-style: italic;'>Analyse du catalogue...</p>";

    try {
        // 1. Récupération de TOUTES les ressources de votre catalogue général
        const { data: allResources } = await supabaseInstance
            .from('resources')
            .select('*')
            .order('title', { ascending: true });

        // 2. Récupération des liaisons existantes pour cet élève dans votre table student_resources
        const { data: currentAssignments } = await supabaseInstance
            .from('student_resources')
            .select('resource_id')
            .eq('student_id', studentId);

        // Extraction simple des IDs déjà attribués pour savoir quelles cases cocher
        const assignedIds = currentAssignments ? currentAssignments.map(a => a.resource_id) : [];

        if (!allResources || allResources.length === 0) {
            container.innerHTML = "<p style='color: #c0392b; font-style: italic;'>Votre catalogue est vide. Ajoutez d'abord des ressources dans l'onglet Catalogue.</p>";
            return;
        }

        container.innerHTML = ""; // Nettoie le conteneur

        // 3. Génération visuelle des cases à cocher
        allResources.forEach(res => {
            const isChecked = assignedIds.includes(res.id) ? "checked" : "";

            const row = document.createElement('div');
            row.className = "assignment-row";
            row.innerHTML = `
                <input type="checkbox" id="check-${res.id}" ${isChecked} onchange="toggleResourceAccess('${res.id}')">
                <label for="check-${res.id}" style="cursor:pointer; font-size: 14px; display: block; width: 100%;">
                    <strong>${res.title}</strong> <span style="font-size: 11px; color:#7f8c8d;">(${res.type})</span>
                </label>
            `;
            container.appendChild(row);
        });

    } catch (err) {
        console.error("Erreur d'ouverture de la gestion des accès :", err);
        container.innerHTML = "<p style='color: #c0392b;'>Erreur lors du chargement des droits d'accès.</p>";
    }
}

// --- 5. BIS. ACTION SÉCURISÉE AU CLIC SUR CHAQUE CASE À COCHER ---
window.toggleResourceAccess = async function (resourceId) {
    const checkbox = document.getElementById(`check-${resourceId}`);
    if (!checkbox || !activeStudentId) return;

    const shouldAssign = checkbox.checked; // true si coché, false si décoché

    try {
        if (shouldAssign) {
            // L'administrateur coche la case -> On ajoute la ligne dans student_resources
            await supabaseInstance
                .from('student_resources')
                .insert([{ student_id: activeStudentId, resource_id: resourceId }]);
        } else {
            // L'administrateur décoche la case -> On retire la ligne de student_resources
            await supabaseInstance
                .from('student_resources')
                .delete()
                .eq('student_id', activeStudentId)
                .eq('resource_id', resourceId);
        }
    } catch (err) {
        console.error("Erreur lors de la modification des accès :", err);
        alert("Impossible de modifier l'accès de la ressource.");
    }
}

// Fonction pour refermer la fenêtre modale
window.closeAccessManagement = function () {
    const modal = document.getElementById('access-modal');
    if (modal) modal.style.display = "none";
    activeStudentId = null;
}

// --- 6. SYNCHRONISATION ET EXTRACTION DES MORCEAUX PAR EDGE FUNCTION ---
async function fetchRealYouTubeTitles(playlistIdOrUrl, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        container.innerHTML = '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Synchronisation en cours avec YouTube...</span>';

        // Appel de votre Edge Function de confiance
        const { data, error } = await supabaseInstance.functions.invoke('get-youtube-playlist', {
            body: { playlistId: playlistIdOrUrl }
        });

        // Interception des erreurs de configuration transmises par la fonction
        if (error || !data || data.error) {
            const errMessage = data?.error || error?.message || "Impossible de joindre le serveur.";
            container.innerHTML = '<span style="font-size: 12px; color: #e74c3c; font-weight: 500; font-style: italic;">⚠️ ' + errMessage + '</span>';
            return;
        }

        if (!data.items || data.items.length === 0) {
            container.innerHTML = '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Cette playlist ne contient aucune vidéo publique ou non répertoriée.</span>';
            return;
        }

        let listHtml = '<div style="font-size: 12px; font-weight: bold; color: #64748b; margin-bottom: 8px; text-align: left;">📋 Liste des vidéos synchronisées :</div>';

        // Génération de la vraie liste textuelle basée sur vos morceaux réels
        data.items.forEach(function (item) {
            const videoTitle = item.snippet.title; // VRAI TITRE YOUTUBE
            const videoId = item.snippet.resourceId.videoId;
            const thumbnailUrl = item.snippet.thumbnails?.default?.url || "https://youtube.com" + videoId + "/default.jpg"; // VRAIE MINIATURE
            const videoUrl = "https://youtube.com" + videoId;

            listHtml +=
                '<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #f8f9fa; border-radius: 4px; margin-bottom: 6px; border: 1px solid #e2e8f0;">' +
                '<div style="display: flex; align-items: center; gap: 12px; max-width: 80%; text-align: left;">' +
                '<img src="' + thumbnailUrl + '" style="width: 50px; height: 38px; object-fit: cover; border-radius: 3px; border: 1px solid #cbd5e1;" alt="miniature">' +
                '<span style="font-size: 13px; color: #334155; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + videoTitle + '</span>' +
                '</div>' +
                '<a href="' + videoUrl + '" target="_blank" style="font-size: 11px; color: #e74c3c; text-decoration: none; font-weight: bold; white-space: nowrap; margin-left: 10px;">' +
                'Ouvrir →' +
                '</a>' +
                '</div>';
        });

        container.innerHTML = listHtml;

    } catch (err) {
        console.error(err);
        container.innerHTML = '<span style="font-size: 12px; color: #c0392b; font-style: italic;">Erreur de synchronisation réseau.</span>';
    }
}


// --- 7. LOGIQUE DU MENU DÉROULANT ACCORDÉON (REPLIÉ PAR DÉFAUT) ---
window.togglePlaylistMenu = function (itemId, playlistId) {
    const menu = document.getElementById("menu-" + itemId);
    const arrow = document.getElementById("arrow-" + itemId);
    if (!menu) return;

    // Si le menu est fermé -> ON L'OUVRE
    if (menu.style.display === "none") {
        menu.style.display = "block";
        if (arrow) arrow.style.transform = "rotate(90deg)"; // La flèche pivote vers le bas 👇

        // 🚀 OPTIMISATION : Si la liste est vide, on va chercher les vrais morceaux
        if (menu.innerHTML === "") {
            fetchRealYouTubeTitles(playlistId, "menu-" + itemId);
        }
    }
    // Si le menu est ouvert -> ON LE REPLIE
    else {
        menu.style.display = "none";
        if (arrow) arrow.style.transform = "rotate(0deg)"; // La flèche revient en arrière ▶
    }
}


// --- 8. LOGIQUE DE FILTRAGE PAR ONGLET DES SUPPORTS ENREGISTRÉS ---
window.filterResourceCards = function (selectedType) {
    // 1. Mise à jour visuelle des styles des boutons d'onglets
    const allResTabs = document.querySelectorAll('.res-tab');
    allResTabs.forEach(tab => {
        tab.style.background = "#e2e8f0";
        tab.style.color = "#334155";
    });

    // On illumine l'onglet sélectionné
    const activeTab = document.getElementById("res-tab-" + selectedType);
    if (activeTab) {
        activeTab.style.background = "#34495e";
        activeTab.style.color = "white";
    }

    // 2. Filtrage des lignes du catalogue
    const resourceItems = document.querySelectorAll('.resource-item');
    resourceItems.forEach(item => {
        // Si "Tous" est coché ou si le type correspond exactement à l'onglet
        if (selectedType === 'All' || item.dataset.type === selectedType) {
            item.style.display = "flex"; // Réaffiche l'élément (flexbox d'origine)
        } else {
            item.style.display = "none"; // Masque l'élément
        }
    });
}

// --- 9. AFFICHAGE DES LECTEURS DE PARTITIONS ET AUDIOS GOOGLE DRIVE ---
window.toggleDriveFileStream = function (itemId, fileIdOrUrl, fileType) {
    const menu = document.getElementById("menu-" + itemId);
    const arrow = document.getElementById("arrow-" + itemId);
    if (!menu) return;

    // Si le conteneur est ouvert -> On le replie
    if (menu.style.display === "block") {
        menu.style.display = "none";
        if (arrow) arrow.style.transform = "rotate(0deg)";
        return;
    }

    // Si le conteneur est fermé -> On l'ouvre
    menu.style.display = "block";
    if (arrow) arrow.style.transform = "rotate(90deg)";

    // 1. EXTRACTION CHIRURGICALE DE L'ID (Isole le code 1cIycbnh0Buzmn7...)
    let cleanFileId = String(fileIdOrUrl).trim();
    if (cleanFileId.includes("/d/")) {
        const parts = cleanFileId.split("/d/");
        const afterD = parts[1] || "";
        cleanFileId = afterD.split("/")[0];
    } else if (cleanFileId.includes("id=")) {
        const parts = cleanFileId.split("id=");
        const afterId = parts[1] || "";
        cleanFileId = afterId.split("&")[0];
    }

    // 2. EMBED OFFICIEL GOOGLE : On utilise les lecteurs sécurisés officiels de Google Drive
    if (fileType === 'PDF') {
        // Intègre le visualiseur de documents universel de Google
        menu.innerHTML = '<iframe src="https://google.com' + cleanFileId + '/preview" style="width: 100%; height: 500px; border: none; border-radius: 4px;" allow="autoplay"></iframe>';
    } else if (fileType === 'Audio') {
        // Intègre le lecteur audio épuré de Google Drive
        menu.innerHTML =
            '<div style="padding: 10px; text-align: center;">' +
            '<iframe src="https://google.com' + cleanFileId + '/preview" style="width: 100%; max-width: 500px; height: 60px; border: none; border-radius: 4px;"></iframe>' +
            '</div>';
    }
}



// --- 10. DEMANDE DES DROITS DRIVE AVEC FORÇAGE DE JETON (ANTI-MISSING FIX) ---
window.requestGoogleDriveAccess = async function () {
    try {
        const listeScopes = "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/drive.readonly";

        const { data, error } = await supabaseInstance.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scope: listeScopes,
                redirectTo: window.location.href,
                queryParams: {
                    access_type: "offline",
                    prompt: "select_account consent",
                    scope: encodeURIComponent(listeScopes)
                }
            }
        });

        if (error) throw error;

    } catch (err) {
        console.error("Erreur d'initialisation du Drive / YouTube :", err);
    }
}


// --- 11. GESTION DU MENU DÉROULANT ACCORDÉON POUR LES DOSSIERS IREAL PRO ---
window.toggleIRealProFolderMenu = function (itemId, folderId) {
    const menu = document.getElementById("menu-" + itemId);
    const arrow = document.getElementById("arrow-" + itemId);
    if (!menu) return;

    // Si l'accordéon est déjà ouvert -> On le referme
    if (menu.style.display === "block") {
        menu.style.display = "none";
        if (arrow) arrow.style.transform = "rotate(0deg)";
        return;
    }

    // Si l'accordéon est fermé -> On le déploie
    menu.style.display = "block";
    if (arrow) arrow.style.transform = "rotate(90deg)";

    // Si la liste est vide, on va scanner le dossier via l'Edge Function dédiée
    if (menu.innerHTML === "") {
        fetchIRealProFolderFiles(folderId, "menu-" + itemId);
    }
}

// --- 12. APPEL DIRECT DU COMPARTIMENT DE SCAN DRIVE IREAL PRO ---
async function fetchIRealProFolderFiles(folderId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        container.innerHTML = '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Scan du dossier Google Drive et extraction des grilles...</span>';

        // Appel direct et unique de votre nouvelle fonction get-irealpro-folder
        const { data, error } = await supabaseInstance.functions.invoke('get-irealpro-folder', {
            body: { folderId: folderId }
        });

        if (error || !data || data.error) {
            const messageErreur = data?.error || error?.message || "Erreur de liaison.";
            container.innerHTML = '<span style="font-size: 12px; color: #c0392b; font-style: italic;">⚠️ ' + messageErreur + '</span>';
            return;
        }

        if (!data.files || data.files.length === 0) {
            container.innerHTML = '<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Aucun fichier trouvé dans ce dossier Drive.</span>';
            return;
        }

        let listHtml = '<div style="font-size: 12px; font-weight: bold; color: #64748b; margin-bottom: 8px; text-align: left;">📋 Grilles d\'accords synchronisées :</div>';

        // Déploiement individuel de chaque morceau contenu dans le dossier
        data.files.forEach(function (file) {
            // Nettoyage esthétique pour masquer l'extension .html ou .HTML à l'élève
            const cleanName = file.name.replace(".html", "").replace(".HTML", "");
            const previewUrl = "https://google.com" + file.id + "/preview";

            listHtml +=
                '<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #f8f9fa; border-radius: 4px; margin-bottom: 6px; border: 1px solid #e2e8f0;">' +
                '<div style="display: flex; align-items: center; gap: 12px; text-align: left;">' +
                '<div style="font-size: 14px;">📊</div>' +
                '<span style="font-size: 13px; color: #334155; font-weight: 500;">' + cleanName + '</span>' +
                '</div>' +
                '<a href="' + previewUrl + '" target="_blank" style="font-size: 11px; color: #9b59b6; text-decoration: none; font-weight: bold; white-space: nowrap; margin-left: 10px;">' +
                'Ouvrir la grille →' +
                '</a>' +
                '</div>';
        });

        container.innerHTML = listHtml;

    } catch (err) {
        console.error(err);
        container.innerHTML = '<span style="font-size: 12px; color: #c0392b; font-style: italic;">Erreur réseau de synchronisation.</span>';
    }
}


// --- 13. ALGORITHME DE SYNCHRONISATION ANTI-DOUBLON CENTRALISÉ ---
window.triggerGlobalIRealProSync = async function () {
    const syncBtn = document.getElementById('btn-sync-irp-global');
    if (!syncBtn) return;

    syncBtn.disabled = true;
    syncBtn.innerText = "⏳ Scan récursif du Drive en cours...";

    try {
        // 1. Appel du scanner autonome en ligne
        const ID_DOSSIER_IREALPRO = "1WPZ1Mx7oP7myPBx3YSr-HPP6BTqgMCMQ";
        const { data: driveData, error: functionError } = await supabaseInstance.functions.invoke('get-irealpro-folder', {
            body: { folderId: ID_DOSSIER_IREALPRO }
        });

        if (functionError || !driveData || driveData.error) {
            alert("Erreur de scan : " + (driveData?.error || functionError?.message));
            return;
        }

        const driveFiles = driveData.files || [];
        if (driveFiles.length === 0) {
            alert("Aucun morceau .html trouvé dans votre arborescence Google Drive.");
            return;
        }

        // 2. RECUPERATION DES MORCEAUX DEJA EXISTANTS DANS SUPABASE (ANTI-DOUBLON)
        const { data: existingResources, error: dbError } = await supabaseInstance
            .from('resources')
            .select('url')
            .eq('type', 'iRealPro');

        if (dbError) throw dbError;

        // On isole les IDs de fichiers déjà enregistrés dans un tableau
        const existingIds = existingResources ? existingResources.map(r => r.url) : [];

        // 3. FILTRAGE : On ne garde que les fichiers du Drive dont l'ID N'EST PAS dans Supabase
        const nouveauxFichiers = driveFiles.filter(file => !existingIds.includes(file.id));

        if (nouveauxFichiers.length === 0) {
            alert("🔄 Votre catalogue est déjà à jour ! Aucun nouveau morceau détecté sur votre Google Drive.");
            return;
        }

        // 4. INJECTION UNIQUEMENT DES NOUVEAUTÉS (BULK INSERT)
        const lignesAInserer = nouveauxFichiers.map(file => {
            const cleanTitle = file.name.replace(".html", "").replace(".HTML", "");
            return {
                title: cleanTitle,
                type: "iRealPro",
                url: file.id,          // Stockage sécurisé de l'ID Drive unique
                folder_name: file.folder_name
            };
        });

        const { error: insertError } = await supabaseInstance.from('resources').insert(lignesAInserer);

        if (insertError) {
            alert("Erreur d'insertion en base : " + insertError.message);
        } else {
            alert(`🎉 Synchronisation réussie ! ${lignesAInserer.length} nouveaux morceaux ont été découverts et ajoutés à votre arborescence !`);
        }

    } catch (err) {
        console.error(err);
        alert("Une erreur réseau est survenue lors de la synchronisation.");
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerText = "🔄 Fetch and Update";
        fetchResources(); // Déploie instantanément le nouveau Tree View
    }
}

// Fonction de pilotage pour le Tree View Récursif
window.toggleRecursiveFolder = function (menuId, arrowId) {
    const menu = document.getElementById(menuId);
    const arrow = document.getElementById(" + arrowId + "); // Correction de ciblage d'élément
    const targetArrow = arrow || document.getElementById(arrowId);
    if (!menu) return;

    const isHidden = menu.style.display === "none" || menu.style.display === "";
    menu.style.display = isHidden ? "flex" : "none";
    if (targetArrow) targetArrow.style.transform = isHidden ? "rotate(90deg)" : "rotate(0deg)";
}

// --- 14. ALGORITHME DE SYNCHRONISATION CENTRALISÉ POUR LES AUDIOS ---
window.triggerGlobalAudioSync = async function () {
    const syncBtn = document.getElementById('btn-sync-audio-global');
    if (!syncBtn) return;

    // ⚠️ EMBARQUEZ ICI L'ID UNIQUE DE VOTRE DOSSIER /Octave Art/Ressources/Audios
    const ID_DOSSIER_AUDIOS = "1tP8F7hajSS2v8Uz9OS5KiX37r8vkiL8Z";

    syncBtn.disabled = true;
    syncBtn.innerText = "⏳ Scan récursif des pistes Audio...";

    try {
        // Appel de votre nouvelle Edge Function autonome get-audio-folder
        const { data: driveData, error: functionError } = await supabaseInstance.functions.invoke('get-audio-folder', {
            body: { folderId: ID_DOSSIER_AUDIOS }
        });

        if (functionError || !driveData || driveData.error) {
            alert("Erreur de scan Audio : " + (driveData?.error || functionError?.message));
            return;
        }

        const driveFiles = driveData.files || [];
        if (driveFiles.length === 0) {
            alert("Aucune piste sonore (.mp3, .wav) détectée dans votre arborescence Drive.");
            return;
        }

        // Récupération des audios déjà enregistrés dans Supabase pour l'anti-doublon
        const { data: existingResources } = await supabaseInstance
            .from('resources')
            .select('url')
            .eq('type', 'Audio');

        const existingIds = existingResources ? existingResources.map(r => r.url) : [];

        // Filtrage mathématique : On ne garde que les fichiers absents de Supabase
        const nouveauxFichiers = driveFiles.filter(file => !existingIds.includes(file.id));

        if (nouveauxFichiers.length === 0) {
            alert("🔄 Votre catalogue audio est déjà parfaitement à jour !");
            return;
        }

        // Préparation de l'injection en masse
        const lignesAInserer = nouveauxFichiers.map(file => {
            const cleanTitle = file.name.replace(".mp3", "").replace(".wav", "").replace(".m4a", "").replace(".MP3", "");
            return {
                title: cleanTitle,
                type: "Audio",
                url: file.id,
                folder_name: file.folder_name // Conserve la hiérarchie complète des répertoires
            };
        });

        const { error: insertError } = await supabaseInstance.from('resources').insert(lignesAInserer);

        if (insertError) {
            alert("Erreur d'insertion en base : " + insertError.message);
        } else {
            alert(`🎉 Synchronisation audio réussie ! ${lignesAInserer.length} nouvelles pistes ont été indexées et classées !`);
        }

    } catch (err) {
        console.error(err);
        alert("Une erreur réseau est survenue lors du scan audio.");
    } finally {
        syncBtn.disabled = false;
        syncBtn.innerText = "🔄 Fetch and Update";
        fetchResources(); // Actualise immédiatement l'affichage pour dessiner le Tree View vert
    }
}

// --- 15. ALGORITHME DE SYNCHRONISATION ANTI-DOUBLON POUR YOUTUBE (JETON FIX) ---
window.triggerGlobalYouTubeSync = async function () {
    const syncBtn = document.getElementById('btn-sync-yt-global');
    if (!syncBtn) return;

    syncBtn.disabled = true;
    syncBtn.innerText = "⏳ Scan des Playlists sur YouTube...";

    try {
        // ✅ RECUPERATION DU JETON DE SESSION ACTIF DEPUIS VOTRE NAVIGATEUR
        const { data: sessionData } = await supabaseInstance.auth.getSession();
        const tokenGoogleProf = sessionData?.session?.provider_token;

        if (!tokenGoogleProf) {
            alert("Jeton Google manquant. Veuillez cliquer sur 'Autoriser le Drive' pour rafraîchir vos droits de session.");
            return;
        }

        // On transmet le jeton Google valide de la main à la main
        const { data: ytData, error: functionError } = await supabaseInstance.functions.invoke('get-youtube-channels-playlists', {
            body: { googleToken: tokenGoogleProf } // ✅ LE JETON EST TRANSMIS DIRECTEMENT
        });

        if (functionError || !ytData || ytData.error) {
            alert("Erreur de scan YouTube : " + (ytData?.error || functionError?.message));
            return;
        }

        const driveFiles = ytData.files || [];
        if (driveFiles.length === 0) {
            alert("Aucune vidéo valide trouvée dans vos playlists 'Octave Art - '.");
            return;
        }

        // Récupération des vidéos existantes pour l'anti-doublon
        const { data: existingResources } = await supabaseInstance.from('resources').select('url').eq('type', 'YouTube');
        const existingIds = existingResources ? existingResources.map(r => r.url) : [];

        // Filtrage des nouveautés
        const nouveauxFichiers = driveFiles.filter(file => !existingIds.includes(file.id));

        if (nouveauxFichiers.length === 0) {
            alert("🔄 Votre catalogue de vidéos YouTube est déjà parfaitement à jour !");
            return;
        }

        // Préparation de l'injection en masse avec la colonne thumbnail
        const lignesAInserer = nouveauxFichiers.map(file => {
            return {
                title: file.name,
                type: "YouTube",
                url: file.id,
                folder_name: file.folder_name,
                thumbnail: file.thumbnail // ✅ AJOUTEZ CETTE LIGNE POUR SAUVEGARDER L'IMAGE DANS SUPABASE
            };
        });


        const { error: insertError } = await supabaseInstance.from('resources').insert(lignesAInserer);
        if (insertError) alert("Erreur d'insertion base : " + insertError.message);
        else alert(`🎉 Synchronisation réussie ! ${lignesAInserer.length} nouvelles vidéos ont été ajoutées !`);

    } catch (err) { console.error(err); }
    finally {
        syncBtn.disabled = false; syncBtn.innerText = "🔄 Fetch and Update YouTube";
        fetchResources();
    }
}

// Variable globale réutilisable pour stocker la liste brute des accords issus de Supabase
let DATA_CHORDS_CACHE = [];

window.fetchGuitarChords = async function() {
    try {
        const { data: chords, error } = await supabaseInstance
            .from('guitar_chords')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        // On scelle les données dans le cache pour pouvoir les filtrer instantanément en local
        DATA_CHORDS_CACHE = chords || [];
        
        // On lance le premier affichage à blanc (sans filtre)
        window.filterGuitarChordsWidget();

    } catch (err) { 
        console.error("Erreur de chargement du dictionnaire d'accords :", err); 
    }
}

// --- 18. MOTEUR DE TRANSPOSITION UNIVERSEL SÉCURISÉ (CASE 20 NETTE) ---
window.handleChordFormSubmit = async function(event) {
    event.preventDefault();
    
    const inputName = document.getElementById('chord-name').value.trim();
    const isMultiTone = document.getElementById('chord-transpose-all').checked;

    const NOTES_DIESES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const NOTES_BEMOLS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

    // 💡 TABLE DE CONVERSION CHORDICTIONARY UNIVERSELLE (0 à 20)
    // Permet d'éviter le blocage de .toString(16) qui s'arrête à 15 (f)
    function encoderFrettePourChordictionary(num) {
        if (num === null) return 'x';
        if (num >= 0 && num <= 9) return num.toString();
        // Le tableau s'arrête à J (frette 19)
        const lettresDictionnaire = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
        return lettresDictionnaire[num - 10];
    }

    // 1. RECOMBINAISON INITIALE : Lecture des 6 petits champs texte
    const stringInputs = document.querySelectorAll(".chord-string-input");
    const frettesOrigine = [];
    let inputFingeringStandard = "";

    for (let i = 0; i < stringInputs.length; i++) {
        let caseValue = stringInputs[i].value.trim();
        
        if (caseValue === "" || caseValue.toLowerCase() === "x") {
            frettesOrigine.push(null);
            inputFingeringStandard += "x";
        } else {
            const numCase = parseInt(caseValue, 10);
            if (isNaN(numCase) || numCase < 0 || numCase > 19) {
                alert(`Frette invalide sur la corde ${i + 1}. Saisissez un nombre entre 0 et 19.`);
                stringInputs[i].focus();
                return;
            }
            frettesOrigine.push(numCase);
            inputFingeringStandard += encoderFrettePourChordictionary(numCase);
        }
    }

    // Cas A : L'utilisateur ne coche pas l'option (Insertion unitaire simple)
    if (!isMultiTone) {
        try {
            const { error } = await supabaseInstance
                .from('guitar_chords')
                .insert([{ name: inputName, fingering: inputFingeringStandard }]);
                
            if (error) throw error;
            alert(`L'accord unique ${inputName} a été enregistré !`);
            document.getElementById('chord-form').reset();
            fetchGuitarChords();
        } catch (err) { alert("Erreur d'insertion : " + err.message); }
        return;
    }

    // 🔬 Cas B : ALGORITHME DE TRANSPOSITION ALPHANUMÉRIQUE EN CASCADE
//    const matchNote = inputName.match(/^([A-G][#b]?)(.*)\$/);
    const matchNote = inputName.match(/^([A-G][#b]?)(.*)$/);
    if (!matchNote) {
        alert("Pour transposer, le nom de l'accord doit commencer par une note valide (A à G). Exemple : E7, Cmaj7, F#m");
        return;
    }

    const noteFondamentale = matchNote[1];
    const extensionAccord = matchNote[2];

    let indexBase = NOTES_DIESES.indexOf(noteFondamentale);
    if (indexBase === -1) indexBase = NOTES_BEMOLS.indexOf(noteFondamentale);
    if (indexBase === -1) { alert("Note fondamentale non reconnue."); return; }

    const listeAccordsTransposes = [];

    // On balaie l'intégralité du manche de -20 à +20 cases de décalage pour couvrir toutes les frettes
    for (let decalageCases = -20; decalageCases <= 20; decalageCases++) {
        
        const nouvellesFrettes = frettesOrigine.map(frette => frette === null ? null : frette + decalageCases);
        const valeursActives = nouvellesFrettes.filter(f => f !== null);
        
        if (valeursActives.length === 0) continue;

        const caseMaxDuSchema = Math.max(...valeursActives);
        const caseMinDuSchema = Math.min(...valeursActives);

        // 🛑 CONDITION LIMITANTE ABSOLUE : L'accord monte maintenant RÉELLEMENT jusqu'à la case 20 nette !
        if (caseMinDuSchema >= 0 && caseMaxDuSchema <= 19) {
            
            const nouvelIndexNote = (indexBase + decalageCases + 144) % 12;
            
            // Reconstitution de la chaîne à 6 caractères via notre encodeur étanche
            const nouveauDoigteString = nouvellesFrettes.map(f => encoderFrettePourChordictionary(f)).join('');

            // Double sécurité de longueur de chaîne
            if (nouveauDoigteString.length !== 6) continue;

            const nomDiesis = NOTES_DIESES[nouvelIndexNote] + extensionAccord;
            const nomBemol = NOTES_BEMOLS[nouvelIndexNote] + extensionAccord;

            // Ajout de la version Dièse
            if (!listeAccordsTransposes.some(a => a.name === nomDiesis && a.fingering === nouveauDoigteString)) {
                listeAccordsTransposes.push({ name: nomDiesis, fingering: nouveauDoigteString });
            }
            
            // Ajout de la version Bémol (Enharmonie) si le nom est différent
            if (nomDiesis !== nomBemol) {
                if (!listeAccordsTransposes.some(a => a.name === nomBemol && a.fingering === nouveauDoigteString)) {
                    listeAccordsTransposes.push({ name: nomBemol, fingering: nouveauDoigteString });
                }
            }
        }
    }

    if (listeAccordsTransposes.length === 0) { alert("Aucune transposition possible."); return; }

    try {
        // Insertion globale en bloc
        const { error } = await supabaseInstance
            .from('guitar_chords')
            .insert(listeAccordsTransposes); 

        if (error) throw error;

        alert(`🎉 Succès total ! ${listeAccordsTransposes.length} accords transposés ont été calculés et injectés (cases 0 à 20 opérationnelles) !`);
        document.getElementById('chord-form').reset();
        fetchGuitarChords();

    } catch (err) {
        console.error(err);
        alert("Erreur lors de l'injection en masse : " + err.message);
    }
}




window.deleteGuitarChord = async function(chordId, chordName) {
    if (!confirm(`Supprimer l'accord ${chordName} de la base de données ?`)) return;
    const { error } = await supabaseInstance.from('guitar_chords').delete().eq('id', chordId);
    if (error) alert(error.message); else fetchGuitarChords();
}

// --- 17. MOTEUR DU WIDGET : FILTRAGE ET RENDU GRAPHIQUE UNIVERSEL (FIX INDEX) ---
window.filterGuitarChordsWidget = function() {
    const searchInput = document.getElementById('chord-search-input');
    const resultsContainer = document.getElementById('chord-widget-results');
    if (!resultsContainer) return;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    // Le filtrage textuel en mémoire vive
    const accordsFiltres = DATA_CHORDS_CACHE.filter(chord => {
        const nomMatch = chord.name.toLowerCase().includes(query);
        const fingeringMatch = chord.fingering.toLowerCase().includes(query);
        return nomMatch || fingeringMatch;
    });

    if (accordsFiltres.length === 0) {
        resultsContainer.innerHTML = `<p style="grid-column: 1/-1; color: #94a3b8; font-style: italic; text-align: center; font-size: 13px; padding: 20px;">Aucun accord ne correspond.</p>`;
        return;
    }

    resultsContainer.innerHTML = "";

    accordsFiltres.forEach(chord => {
        const card = document.createElement('div');
        card.style.background = "#faf5ff"; card.style.border = "1px solid #e9d5ff";
        card.style.borderRadius = "8px"; card.style.padding = "12px";
        card.style.display = "flex"; card.style.flexDirection = "column"; card.style.alignItems = "center";
        card.style.position = "relative";

        card.innerHTML = `
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                <strong style="color: #4c1d95; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${chord.name}</strong>
                <button type="button" onclick="deleteGuitarChord('${chord.id}', '${chord.name}')" style="background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer; padding: 0; font-weight: bold;">✕</button>
            </div>
            <div id="chord-svg-${chord.id}" style="margin: 5px 0;"></div>
        `;

        resultsContainer.appendChild(card);

        // 🎼 DECODEUR UNIVERSEL CORRIGÉ (A-K -> 10-20)
        const lettresDictionnaire = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
        
        const doigteTableauConforme = chord.fingering.split('').map(char => {
            const lettreMajuscule = char.toUpperCase();
            if (lettreMajuscule === 'X') return 'x';
            
            const indexLettre = lettresDictionnaire.indexOf(lettreMajuscule);
            // ✅ LA CORRECTION CHIRURGICALE : On utilise indexLettre pour calculer le numéro de frette
            if (indexLettre !== -1) {
                return (indexLettre + 10).toString(); // Convertit en texte (ex: index 2 pour 'C' -> "12")
            }
            return lettreMajuscule;
        });

        // 1. Instanciation de l'instrument guitare (6 cordes, 24 cases)
        const guitare = new chordictionary.Instrument("EADGBE", 24);
        
        // 2. Appel de l'API avec le tableau de chaînes de caractères nettoyé
        const diagrammeHtml = guitare.getChordLayout(doigteTableauConforme.join(""));
        
        // 3. Injection du code vectoriel SVG au cœur de la carte
        const svgBox = document.getElementById(`chord-svg-${chord.id}`);
        if (svgBox && diagrammeHtml) {
            svgBox.innerHTML = diagrammeHtml;
        }
    });
}


// ✅ REFACTORISATION ÉPURÉE : NAVIGATION MANUELLE PAR TABULATION ET RETOUR ARRIÈRE
document.addEventListener("DOMContentLoaded", () => {
    const stringInputs = document.querySelectorAll(".chord-string-input");
    
    stringInputs.forEach((input, index) => {
        // La gestion du saut automatique à l'écriture (input) a été purement et simplement supprimée.
        // Vous pouvez désormais taper "1", puis "2" sans que le curseur ne s'échappe !

        // On conserve uniquement la touche "Retour arrière" pour le confort de correction
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && e.target.value.length === 0 && index > 0) {
                e.preventDefault(); // Évite la suppression de caractères indésirables
                stringInputs[index - 1].focus();
                // Sélectionne le texte existant dans le champ précédent pour pouvoir écraser rapidement
                stringInputs[index - 1].select(); 
            }
        });
    });
});


// --- 19. ALGORITHME DE SYNCHRONISATION ANTI-DOUBLON POUR LES PARTITIONS ---
window.triggerGlobalPartitionsSync = async function() {
    const syncBtn = document.getElementById('btn-sync-partitions-global');
    if (!syncBtn) return;

    // ⚠️ EMBARQUEZ ICI L'ID UNIQUE DE VOTRE DOSSIER /Octave Art/Ressources/Partitions
    const ID_DOSSIER_PARTITIONS = "152GjsrLUjjN1syUM1YQp0cACXmL6VxZe"; 

    syncBtn.disabled = true;
    syncBtn.innerText = "⏳ Scan récursif des Partitions...";

    try {
        const { data: sessionData } = await supabaseInstance.auth.getSession();
        const tokenGoogleProf = sessionData?.session?.provider_token;

        const { data: driveData, error: functionError } = await supabaseInstance.functions.invoke('get-partitions-folder', { 
            body: { folderId: ID_DOSSIER_PARTITIONS, googleToken: tokenGoogleProf } 
        });

        if (functionError || !driveData || driveData.error) {
            alert("Erreur de scan Partitions : " + (driveData?.error || functionError?.message));
            return;
        }

        const driveFiles = driveData.files || [];
        if (driveFiles.length === 0) {
            alert("Aucun fichier (.pdf, .xml, .musicxml) détecté dans votre répertoire.");
            return;
        }

        // 1. ÉLARGISSEMENT DE LA SÉLECTION DES DOUBLONS SUPABASE (Vers la ligne 30) :
        // On vérifie les trois types à la fois pour ne rien injecter deux fois
        const { data: existingResources } = await supabaseInstance
            .from('resources')
            .select('url')
            .in('type', ['PDF', 'MusicXML', 'iRealPro']);

        const existingIds = existingResources ? existingResources.map(r => r.url) : [];
        const nouveauxFichiers = driveFiles.filter(file => !existingIds.includes(file.id));

        if (nouveauxFichiers.length === 0) {
            alert("🔄 Votre répertoire de partitions et grilles est déjà à jour !");
            return;
        }

        // 2. ADAPTATION DU NETTOYAGE DES LIGNES (Vers la ligne 42) :
        const lignesAInserer = nouveauxFichiers.map(file => {
            // Nettoie l'extension de fichier peu importe le format détecté
            const cleanTitle = file.name
                .replace(".pdf","").replace(".xml","").replace(".musicxml","").replace(".html","")
                .replace(".PDF","").replace(".HTML","");
                
            return {
                title: cleanTitle,
                type: file.type, // PDF, MusicXML, ou iRealPro
                url: file.id,
                folder_name: file.folder_name
            };
        });


        const { error: insertError } = await supabaseInstance.from('resources').insert(lignesAInserer);
        if (insertError) alert(insertError.message);
        else alert(`🎉 Succès ! ${lignesAInserer.length} nouvelles partitions ont été indexées !`);

    } catch (err) { console.error(err); }
    finally {
        syncBtn.disabled = false; syncBtn.innerText = "🔄 Fetch and Update Partitions";
        fetchResources();
    }
}


// =================================================================
// 📅 20. CENTRE DE CONTRÔLE PRIVÉ - GOOGLE CALENDAR API V3
// =================================================================
window.fetchGoogleCalendarEvents = async function() {
    const container = document.getElementById('calendar-events-container');
    if (!container) return;

    container.innerHTML = `<li style="color: #888; font-style: italic; text-align: center; padding: 15px;">⏳ Connexion sécurisée à Google Calendar...</li>`;

    try {
        const { data: sessionData } = await supabaseInstance.auth.getSession();
        const googleToken = sessionData?.session?.provider_token;

        if (!googleToken) {
            container.innerHTML = `<li style="color: #c0392b; font-weight: bold; text-align: center; padding: 15px;">🔒 Clé Google expirée. Veuillez cliquer sur 'Autoriser le Drive' pour activer la gestion du planning.</li>`;
            return;
        }

        // 1. Récupération préalable de la liste des élèves pour faire la correspondance des noms
        const { data: students } = await supabaseInstance
            .from('profiles')
            .select('id, first_name, last_name')
            .eq('role', 'student');

        const mapStudents = {};
        if (students) {
            students.forEach(s => {
                mapStudents[s.id] = `${s.last_name.toUpperCase()} ${s.first_name}`;
            });
        }

        // 2. Définition de la fenêtre glissante des 3 prochains mois
        const dateAujourdHui = new Date();
        const dateDansTroisMois = new Date();
        dateDansTroisMois.setMonth(dateAujourdHui.getMonth() + 3);

        const urlCalendar = "https://www.googleapis.com/calendar/v3/calendars/d1c0a7425aef44bfd3b8e7ee1aec5592b2cbf9826dcac306c63ed4f065233f5a@group.calendar.google.com/events?" +
                            `timeMin=${dateAujourdHui.toISOString()}&` +
                            `timeMax=${dateDansTroisMois.toISOString()}&` +
                            `singleEvents=true&` + 
                            `orderBy=startTime&` + 
                            `maxResults=100`;

        const response = await fetch(urlCalendar, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${googleToken}` }
        });

        if (!response.ok) throw new Error("Impossible de lire votre agenda.");

        const data = await response.json();
        const events = data.items || [];

        if (events.length === 0) {
            container.innerHTML = `<li style="color: #888; font-style: italic; text-align: center; padding: 15px;">Aucun cours planifié dans les 3 prochains mois.</li>`;
            return;
        }

        container.innerHTML = "";
        events.forEach(event => {
            const start = event.start.dateTime || event.start.date;
            const dateObj = new Date(start);
            
            const dateFormatee = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            const heureFormatee = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            // 🔬 RECONSTITUTION DE LA LISTE DES PARTICIPANTS
            const privateProps = event.extendedProperties?.private || {};
            const rawStudentIds = privateProps.student_ids || "";
            let texteElevesNoms = [];

            if (rawStudentIds) {
                rawStudentIds.split(",").forEach(id => {
                    const nomTrouve = mapStudents[id.trim()];
                    if (nomTrouve) texteElevesNoms.push(nomTrouve);
                });
            }

            // Génération de la puce texte ou du badge collectif
            let htmlParticipants = "";
            if (texteElevesNoms.length > 0) {
                htmlParticipants = `<div style="font-size: 12px; color: #475569; margin-top: 5px; font-weight: 500;">👤 Participants : <span style="color: #2c3e50; font-weight: bold;">${texteElevesNoms.join(', ')}</span></div>`;
            } else {
                htmlParticipants = `<div style="font-size: 11px; color: #94a3b8; margin-top: 5px; font-style: italic;">Aucun élève relié à ce créneau.</div>`;
            }

            const li = document.createElement('li');
            li.style.display = "flex"; li.style.justifyContent = "space-between"; li.style.alignItems = "center";
            li.style.padding = "12px"; li.style.background = "#fff9f2"; li.style.border = "1px solid #fde6d2";
            li.style.borderRadius = "6px"; li.style.marginBottom = "8px";

            const estUnCoursRecurrent = event.recurringEventId ? "🔄 " : "📅 ";

            li.innerHTML = `
                <div style="text-align: left; max-width: 75%;">
                    <strong style="color: #d35400; font-size: 14px;">${estUnCoursRecurrent}${event.summary}</strong> <br>
                    <span style="font-size: 12px; color: #e67e22; font-weight: 600;">Le ${dateFormatee} à ${heureFormatee}</span>
                    ${htmlParticipants} <!-- ✅ INJECTION DE LA LISTE DES ELEVES JUSTE EN DESSOUS -->
                </div>
                <button type="button" style="background: #c0392b; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer; white-space: nowrap;" 
                        onclick="deleteGoogleCalendarEvent('${event.id}', '${event.summary.replace(/'/g, "\\'")}', ${!!event.recurringEventId})">
                    Supprimer
                </button>
            `;
            container.appendChild(li);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<li style="color: #c0392b; font-style: italic; text-align: center; padding: 15px;">⚠️ Erreur de chargement du planning.</li>`;
    }
}


// --- 20. PLANIFICATION AVEC DOUBLE LISTE ÉLÈVES & EXCLUSION DES VACANCES (ZONE FIX) ---
window.handleCreateGoogleEvent = async function(event) {
    event.preventDefault();
    
    const title = document.getElementById('event-title').value.trim();
    const startDate = document.getElementById('event-start-date').value;
    const startTime = document.getElementById('event-start-time').value;
    const endRecurrenceDate = document.getElementById('event-end-recurrence-date').value;
    const durationMinutes = parseInt(document.getElementById('event-duration').value, 10);
    // ✅ UTILISATION DE LA VARIABLE UTILISÉE POUR INTERROGER LE BON CALENDRIER
    const selectedZone = document.getElementById('event-vacations-zone').value;

    // Capture directe du tableau issu de vos double-clics
    const selectedStudentIds = LISTE_STUDENTS_CALENDAR_SELECTED;

    if (selectedStudentIds.length === 0) {
        alert("Veuillez sélectionner au moins un élève par double-clic dans la liste pour ce cours.");
        return;
    }

    const btnSubmit = document.getElementById('btn-create-event');
    btnSubmit.disabled = true; btnSubmit.innerText = "⏳ Analyse des vacances & calcul des exclusions...";

    try {
        const { data: sessionData } = await supabaseInstance.auth.getSession();
        const googleToken = sessionData?.session?.provider_token;
        if (!googleToken) { alert("Session expirée. Veuillez cliquer sur 'Autoriser le Drive'."); return; }

        // Calcul des repères chronologiques ISO8601 de base
        const startDateTime = new Date(`${startDate}T${startTime}:00`);
        const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

        let chaineRecurrence = null;

        // 🔬 ANCHOR : DÉTECTION DU MODE (PONCTUEL OU RÉCURRENT)
        if (endRecurrenceDate.trim() !== "") {
            // =============================================================
            // MODE A : COURS RÉCURRENT (Le champ 'Dernier cours' est rempli)
            // =============================================================
            const limitRecurrenceDate = new Date(`${endRecurrenceDate}T23:59:59`);
            let exdates = [];

            if (selectedZone !== "none") {
                const listAgendasRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
                    headers: { 'Authorization': `Bearer ${googleToken}` }
                });
                const listAgendas = await listAgendasRes.json();
                
                const agendaVacances = (listAgendas.items || []).find(cal => 
                    cal.summary.toLowerCase().includes("vacances") && cal.summary.toLowerCase().includes(selectedZone.toLowerCase())
                );

                if (agendaVacances) {
                    const urlEventsVacances = `https://www.googleapis.com/calendar/v3/calendars/${agendaVacances.id}/events?timeMin=${startDateTime.toISOString()}&timeMax=${limitRecurrenceDate.toISOString()}&singleEvents=true`;
                    const resVacances = await fetch(urlEventsVacances, { headers: { 'Authorization': `Bearer ${googleToken}` } });
                    const dataVacances = await resVacances.json();
                    const listVacances = dataVacances.items || [];

                    let curseurDateCours = new Date(startDateTime.getTime());
                    const heureCompacteGoogle = startTime.replace(":", "") + "00";

                    while (curseurDateCours <= limitRecurrenceDate) {
                        const dateCoursMinuit = new Date(curseurDateCours.getFullYear(), curseurDateCours.getMonth(), curseurDateCours.getDate());

                        const estEnVacances = listVacances.some(vac => {
                            const debutVac = new Date(vac.start.dateTime || vac.start.date + "T00:00:00");
                            const finVac = new Date(vac.end.dateTime || vac.end.date + "T00:00:00");
                            
                            const debutVacMinuit = new Date(debutVac.getFullYear(), debutVac.getMonth(), debutVac.getDate());
                            let finVacMinuit = new Date(finVac.getFullYear(), finVac.getMonth(), finVac.getDate());

                            if (!vac.end.dateTime) {
                                finVacMinuit.setDate(finVacMinuit.getDate() - 1);
                            }
                            return dateCoursMinuit >= debutVacMinuit && dateCoursMinuit <= finVacMinuit;
                        });

                        if (estEnVacances) {
                            const anneeStr = curseurDateCours.getFullYear();
                            const moisStr = String(curseurDateCours.getMonth() + 1).padStart(2, '0');
                            const jourStr = String(curseurDateCours.getDate()).padStart(2, '0');
                            exdates.push(`${anneeStr}${moisStr}${jourStr}T${heureCompacteGoogle}`);
                        }
                        curseurDateCours.setDate(curseurDateCours.getDate() + 7);
                    }
                }
            }

            const dateFinPropre = endRecurrenceDate.replace(/-/g, "");
            chaineRecurrence = [`RRULE:FREQ=WEEKLY;UNTIL=${dateFinPropre}T235959Z`];

            if (exdates.length > 0) {
                chaineRecurrence.push(`EXDATE;TZID=Europe/Paris:${exdates.join(",")}`);
            }
        }

        // 📦 CONSTRUCTION DU STRUCTURE DE L'ÉVÉNEMENT GOOGLE
        const bodyEvent = {
            summary: title,
            description: chaineRecurrence ? `Cours hebdomadaire planifié via Octave Art.` : `Cours ponctuel unique planifié via Octave Art.`,
            start: { dateTime: startDateTime.toISOString(), timeZone: "Europe/Paris" },
            end: { dateTime: endDateTime.toISOString(), timeZone: "Europe/Paris" },
            extendedProperties: {
                private: { "student_ids": selectedStudentIds.join(",") }
            }
        };

        // ✅ Si le mode récurrent est actif, on injecte le tableau de récurrence, sinon on le laisse à null (événement ponctuel) [1.5]
        if (chaineRecurrence) {
            bodyEvent.recurrence = chaineRecurrence;
        }

        const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/d1c0a7425aef44bfd3b8e7ee1aec5592b2cbf9826dcac306c63ed4f065233f5a@group.calendar.google.com/events?sendUpdates=all", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyEvent)
        });

        if (!response.ok) throw new Error("Échec d'insertion auprès de l'API Google.");

        if (exdates.length > 0) {
            alert(`🎉 Succès ! Le cours récurrent '${title}' a été créé. L'application a détecté et annulé automatiquement ${exdates.length} séances tombant pendant les vacances de la ${selectedZone} !`);
        } else {
            alert(`🎉 Succès ! Le cours récurrent '${title}' a été inséré sur toute la période.`);
        }
        
        document.getElementById('calendar-course-form').reset();
        fetchStudentsForCalendarCombo(); // Réinitialise et redessine la double liste d'élèves
        fetchGoogleCalendarEvents(); // Rafraîchit le planning de droite

    } catch (err) {
        console.error(err);
        alert("Erreur de transaction Calendar : " + err.message);
    } finally {
        btnSubmit.disabled = false; btnSubmit.innerText = "🔒 Planifier la récurrence annuelle";
    }
}


// --- 22. ALGORITHME DE SUPPRESSION INTELLIGENTE : SÉANCE ISOLÉE OU SÉRIE ENTIÈRE ---
window.deleteGoogleCalendarEvent = async function(eventId, eventTitle, estUneOccurrence) {
    try {
        const { data: sessionData } = await supabaseInstance.auth.getSession();
        const googleToken = sessionData?.session?.provider_token;
        if (!googleToken) { alert("Session expirée. Veuillez cliquer sur 'Autoriser le Drive'."); return; }

        let urlSuppression = `https://www.googleapis.com/calendar/v3/calendars/d1c0a7425aef44bfd3b8e7ee1aec5592b2cbf9826dcac306c63ed4f065233f5a@group.calendar.google.com/events/${eventId}`;
        let messageConfirmation = `Supprimer définitivement le cours '${eventTitle}' de votre Google Agenda ?`;

        // 🔄 CAS A : LE COURS REPRÉSENTE UNE OCCURRENCE D'UNE SÉRIE ANNUELLE
        if (estUneOccurrence) {
            // Demande d'arbitrage claire à l'enseignant
            const confirmationChoix = confirm(
                `Ce cours fait partie d'une série récurrente.\n\n` +
                `• Cliquez sur [OK] pour annuler UNIQUEMENT cette séance précise.\n` +
                `• Cliquez sur [ANNULER] pour supprimer TOUTE la série de l'année scolaire.`
            );

            if (confirmationChoix) {
                // 1️⃣ Option 1 : Annuler UNIQUEMENT cette séance isolée [1.5]
                // Pour annuler une seule occurrence sans détruire la récurrence, Google exige de passer son statut à "cancelled" via un PATCH [1.5]
                const responsePatch = await fetch(urlSuppression, {
                    method: 'PATCH',
                    headers: { 
                        'Authorization': `Bearer ${googleToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: "cancelled" }) // Marque l'événement comme annulé à cette date
                });

                if (!responsePatch.ok) throw new Error("Échec de l'annulation de la séance isolée.");
                alert(`Le cours de '${eventTitle}' pour cette date précise a été annulé avec succès !`);
                fetchGoogleCalendarEvents(); // Rafraîchit l'affichage
                return; // On stoppe ici
            } else {
                // 2️⃣ Option 2 : L'enseignant a cliqué sur "Annuler" ➔ Il souhaite cibler la série entière [1.5]
                if (confirm(`⚠️ Confirmation : Voulez-vous supprimer définitivement TOUTE la série annuelle de cours pour '${eventTitle}' ?`)) {
                    // Dans l'API Google, l'ID d'une occurrence est structuré ainsi : IDPARENT_DATE (ex: abcde_20261011T140000Z).
                    // Pour détruire la racine, on isole le texte situé avant le premier tiret du bas (_) [1.5]
                    const idParentBase = eventId.split("_")[0];
                    urlSuppression = `https://www.googleapis.com/calendar/v3/calendars/d1c0a7425aef44bfd3b8e7ee1aec5592b2cbf9826dcac306c63ed4f065233f5a@group.calendar.google.com/events/${idParentBase}`;
                } else {
                    return; // L'utilisateur change d'avis, on quitte
                }
            }
        } else {
            // 📅 CAS B : L'ÉVÉNEMENT EST UNIQUE (NON RÉCURRENT)
            if (!confirm(messageConfirmation)) return;
        }

        // 🚀 EXÉCUTION DE LA SUPPRESSION GLOBALE (Événement unique ou Série racine)
        const responseDelete = await fetch(urlSuppression, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${googleToken}` }
        });

        if (!responseDelete.ok) throw new Error("Échec de la suppression auprès de l'API Google Calendar.");
        
        alert(`La suppression de l'événement '${eventTitle}' a été enregistrée avec succès !`);
        fetchGoogleCalendarEvents(); // Rafraîchit instantanément la colonne de droite

    } catch (err) { 
        console.error(err); 
        alert("Erreur lors de la suppression : " + err.message);
    }
}


// Variable globale temporaire pour stocker les IDs des participants sélectionnés
let LISTE_STUDENTS_CALENDAR_SELECTED = [];

async function fetchStudentsForCalendarCombo() {
    const availableBox = document.getElementById('cal-available-students');
    const selectedBox = document.getElementById('cal-selected-students');
    if (!availableBox || !selectedBox) return;

    try {
        // ✅ DEUX LIGNES MODIFIÉES : On extrait aussi l'e-mail depuis Supabase
        const { data: students } = await supabaseInstance
            .from('profiles')
            .select('id, first_name, last_name, email') // Assurez-vous que la colonne email existe dans profiles
            .eq('role', 'student')
            .order('last_name', { ascending: true });

        availableBox.innerHTML = "";
        selectedBox.innerHTML = "";
        LISTE_STUDENTS_CALENDAR_SELECTED = [];

        if (!students || students.length === 0) {
            availableBox.innerHTML = '<span style="color: #94a3b8; font-style: italic; font-size: 12px; text-align: center; padding: 10px; display: block;">Aucun élève inscrit.</span>';
            return;
        }

        window.dessinerListesElevesCalendar = function() {
            availableBox.innerHTML = "";
            selectedBox.innerHTML = "";

            students.forEach(student => {
                const item = document.createElement('div');
                item.style.padding = "6px 10px"; item.style.borderRadius = "4px";
                item.style.fontSize = "12px"; item.style.fontWeight = "500";
                item.style.cursor = "pointer"; item.style.userSelect = "none";
                item.style.transition = "background 0.15s";
                item.innerText = `👤 ${student.last_name.toUpperCase()} ${student.first_name}`;
                
                // ✅ HYPER-IMPORTANT : Stockage invisible de l'e-mail dans les métadonnées de l'élément HTML
                item.dataset.email = student.email || ""; 
                item.dataset.id = student.id;

                if (!LISTE_STUDENTS_CALENDAR_SELECTED.includes(student.id)) {
                    item.style.background = "#f1f5f9"; item.style.color = "#334155";
                    
                    item.ondblclick = () => {
                        LISTE_STUDENTS_CALENDAR_SELECTED.push(student.id);
                        window.dessinerListesElevesCalendar();
                    };
                    availableBox.appendChild(item);
                } else {
                    item.style.background = "#fff7ed"; item.style.color = "#c2410c"; item.style.border = "1px solid #ffedd5";
                    
                    item.ondblclick = () => {
                        LISTE_STUDENTS_CALENDAR_SELECTED = LISTE_STUDENTS_CALENDAR_SELECTED.filter(id => id !== student.id);
                        window.dessinerListesElevesCalendar();
                    };
                    selectedBox.appendChild(item);
                }
            });

            if (LISTE_STUDENTS_CALENDAR_SELECTED.length === 0) {
                selectedBox.innerHTML = '<span style="color: #cbd5e1; font-style: italic; font-size: 11px; text-align: center; margin: auto; padding: 10px; display: block;">Double-cliquez sur un élève à gauche pour l\'ajouter.</span>';
            }
        };

        window.dessinerListesElevesCalendar();

    } catch (err) { console.error("Erreur de déploiement des listes :", err); }
}




checkAdminSecurity();