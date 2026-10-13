

import * as Settings from "./settings.js";
import * as Auth from "./auth.js";

document.OctaveArt = document.OctaveArt || {};


document.addEventListener("DOMContentLoaded", () => {
    document.OctaveArt.auth = document.OctaveArt.auth || Auth.auth(document.getElementById("oa-auth-container"));
    document.OctaveArt.auth.renderAuthWidget();
});