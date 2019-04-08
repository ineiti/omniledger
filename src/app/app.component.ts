import {Component, Inject} from '@angular/core';
import {Defaults} from '../lib/Defaults';
import StatusRPC from '../lib/cothority/status/status-rpc';
import {Log} from '../lib/Log';
import {Data, gData, TestData} from '../lib/Data';
import {MAT_DIALOG_DATA, MatDialogRef, MatTabChangeEvent} from '@angular/material';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {Private, Public} from '../lib/KeyPair';
import SkipchainRPC from '../lib/cothority/skipchain/skipchain-rpc';
import {Contact} from '../lib/Contact';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Welcome to DynaSent';
  nodes = [];
  gData: Data;
  registerForm: FormGroup;
  contactForm: FormGroup;
  isRegistered = false;
  isLoaded = false;
  testing = true;
  blockCount = -1;

  constructor() {
    if (!this.testing) {
      this.registerForm = new FormGroup({
        ephemeralKey: new FormControl('dccd8216bb4c87890ab5c52c01366265ba1d57bcfaaa0a384a94597c33c47d0c', Validators.pattern(/[0-9a-fA-F]{64}/)),
        darcID: new FormControl('7ec0220b1a4a5c99578188e81f01036acb6c5c9ead9fb002162b8dd111417a7c', Validators.pattern(/[0-9a-fA-F]{64}/)),
        alias: new FormControl('garfield')
      });

      gData.load().then(() => {
        this.gData = gData;
        Log.print("Contact is:", gData.contact);
        this.isRegistered = gData.contact.isRegistered();
        Log.print("isRegistered: ", this.isRegistered);
        this.updateContactForm();
      }).catch(e => {
        Log.catch(e);
      }).finally(() => {
        this.isLoaded = true;
      })
    }
  }

  async doTest(){
    try {
      // jasmine.DEFAULT_TIMEOUT_INTERVAL = 250000;
      Log.lvl1('Creating Byzcoin');
      let tdAdmin = await TestData.init(new Data());
      for (let i = 0; i < 100; i++){
        Log.print("reading", i);
        await tdAdmin.cbc.bc.updateConfig();
      }
      Log.print("createAll")
      await tdAdmin.createAll('admin');
      Log.print("creating contact");
      let reg1 = new Contact(null, Public.fromRand());
      reg1.alias = 'reg1';
      await tdAdmin.d.registerContact(reg1);
      let unreg2 = new Contact(null, Public.fromRand());
      unreg2.alias = 'unreg2';
    } catch (e){
      Log.catch(e);
      throw new Error(e);
    }
  }

  updateContactForm(){
    this.contactForm = new FormGroup({
      alias: new FormControl(gData.contact.alias),
      email: new FormControl(gData.contact.email, Validators.email),
      phone: new FormControl(gData.contact.phone)
    });
  }

  async updateContact(event: Event){
    gData.contact.alias = this.contactForm.controls['alias'].value;
    gData.contact.email = this.contactForm.controls['email'].value;
    gData.contact.phone = this.contactForm.controls['phone'].value;
    await gData.contact.sendUpdate(gData.keyIdentitySigner);
  }

  async addID(event: Event) {
    try {
      if (this.registerForm.controls['ephemeralKey'].valid) {
        let ekStr = <string> this.registerForm.controls['ephemeralKey'].value;
        let ek = Private.fromHex(ekStr);
        let did = this.registerForm.controls['darcID'].value;
        if (this.registerForm.controls['darcID'].valid && did.length == 64) {
          Log.print('creating first identity');
          gData.contact = await gData.createUser(ek, this.registerForm.controls['alias'].value, Buffer.from(did, 'hex'));
        } else {
          Log.print('creating follow-up identity');
          await gData.attachAndEvolve(ek);
        }
      }
    } catch(e){
      Log.catch(e);
    }
    this.isRegistered = gData.contact.isRegistered();
    await gData.save();
    this.updateContactForm();
    Log.print("done - is registered:", this.isRegistered);
  }

  async createContact(){
    let ek = Private.fromRand();
    await gData.createUser(ek, "test")
  }

  async addContact(){}

  tabChanged(tabChangeEvent: MatTabChangeEvent) {
    switch (tabChangeEvent.index) {
      case 0:
        break;
      case 1:
        break;
      case 2:
        break;
      case 3:
        this.update().catch(e => Log.catch(e));
        break;
    }
  }

  async update() {
    Log.print('updating status of roster');
    this.nodes = [];
    let list = Defaults.Roster.list;
    let srpc = new StatusRPC(Defaults.Roster);
    for (let i = 0; i < list.length; i++) {
      let node = list[i].description;
      try {
        let s = await srpc.getStatus(i);
        node += ': OK - Port:' + JSON.stringify(s.status.Generic.field['Port']);
      } catch (e) {
        node += ': Failed';
      }
      this.nodes.push(node);
    }
    this.nodes.sort();
    await gData.bc.updateConfig();
    let skiprpc = new SkipchainRPC(gData.bc.getConfig().roster);
    let last = await skiprpc.getLatestBlock(gData.bc.genesisID);
    this.blockCount = last.index;
  }
}

export interface DialogData {
  animal: string;
  name: string;
}

@Component({
  selector: 'create-user',
  templateUrl: 'create-user.html',
})
export class CreateUser {

  constructor(
    public dialogRef: MatDialogRef<CreateUser>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

}
