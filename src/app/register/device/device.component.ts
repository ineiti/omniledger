import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material";
import { Router } from "@angular/router";
import Log from "@dedis/cothority/log";
import { Data, gData } from "../../../lib/Data";
import { showSnack } from "../../../lib/ui/Ui";

@Component({
    selector: "app-device",
    styleUrls: ["./device.component.css"],
    templateUrl: "./device.component.html",
})
export class DeviceComponent implements OnInit {
    text: string;

    constructor(
        private router: Router,
        private snack: MatSnackBar,
    ) {
        this.text = "Please wait";
    }

    async ngOnInit() {
        try {
            return showSnack(this.snack, "Attaching to existing user", async () => {
                const newData = await Data.attachDevice(window.location.href);
                await gData.overwrite(newData);
                await gData.save();
                await this.router.navigateByUrl("/user");
            });
        } catch (e) {
            Log.catch("Couldn't register:", e);
            this.text = e.toString();
        }
    }
}