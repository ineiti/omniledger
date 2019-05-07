import { ChangeDetectorRef, Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatSnackBar } from "@angular/material";
import { Log } from "@c4dt/cothority/log";
import { util } from "protobufjs";
import { Contact } from "../../../lib/Contact";
import { gData } from "../../../lib/Data";
import { FileBlob } from "../../../lib/SecureData";

@Component({
  selector: "app-secure",
  styleUrls: ["./secure.component.css"],
  templateUrl: "./secure.component.html",
})
export class SecureComponent implements OnInit {
  calypsoOurKeys: string[];
  calypsoOtherKeys: Map<Contact, FileBlob[]>;

  constructor(public dialog: MatDialog,
              private snackBar: MatSnackBar) {
    this.calypsoOtherKeys = new Map();
  }

  ngOnInit() {
    Log.lvl3("init secure");
  }

  /**
   * updateCalypso stores the keys and the FileBlobs in the class-variables so that the UI
   * can correctly show them.
   */
  updateCalypso() {
    this.calypsoOurKeys = Array.from(gData.contact.calypso.ours.keys());
    Array.from(gData.contact.calypso.others.keys()).forEach((oid) => {
      const other = gData.contacts.find((c) => c.credentialIID.equals(oid));
      const fbs = Array.from(gData.contact.calypso.others.get(oid))
        .map((sd) => FileBlob.fromBuffer(sd.plainData));
      this.calypsoOtherKeys.set(other, fbs);
    });
  }

  async calypsoSearch(c: Contact) {
    const sb = this.snackBar.open("Searching new secure data for " + c.alias.toLocaleUpperCase());
    try {
      const sds = await gData.contact.calypso.read(c);
      await gData.save();
      this.updateCalypso();
    } catch (e) {
      Log.catch(e);
    }
    sb.dismiss();
  }

  async calypsoAccess(key: string) {
    Log.warn("Not yet implemented");
  }

  async calypsoAddData() {
    const fileDialog = this.dialog.open(CalypsoUploadComponent, {
      width: "250px",
    });
    fileDialog.afterClosed().subscribe(async (result: File) => {
      if (result) {
        const data = Buffer.from(await (await new Response((result).slice())).arrayBuffer());
        const contacts = gData.contacts.map((c) => c.darcSignIdentity.id);
        const fb = new FileBlob(result.name, data, [{name: "time", value: result.lastModified.toString()}]);
        const key = await gData.contact.calypso.add(fb.toBuffer(), contacts);
        await gData.save();
        this.updateCalypso();
      } else {
        Log.lvl1("Didnt get any data");
      }
    });
  }

  async calypsoDownload(c: Contact, fb: FileBlob) {
    const a = document.createElement("a");
    const file: any = new Blob([fb.data], {
      type: "application/octet-stream",
    });
    a.href = window.URL.createObjectURL(file);
    a.target = "_blank";
    a.download = fb.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

}

@Component({
  selector: "app-calypso-upload",
  templateUrl: "calypso-upload.html",
})
export class CalypsoUploadComponent {
  file: File;

  constructor(
    public dialogRef: MatDialogRef<CalypsoUploadComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Buffer) {
  }

  cancel(): void {
    this.dialogRef.close();
  }

  async handleFileInput(e: Event) {
    this.file = (e.target as any).files[0] as File;
  }
}
