import { Component } from "@angular/core";

import Log from "@dedis/cothority/log";

@Component({
    selector: "app-user",
    styleUrls: ["./admin.component.css"],
    templateUrl: "./admin.component.html",
})
export class AdminComponent {
    constructor() {
        Log.lvl1("Starting admin");
    }
}