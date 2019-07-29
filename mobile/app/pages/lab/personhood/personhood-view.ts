import {Observable} from "tns-core-modules/data/observable";
import Log from "~/lib/cothority/log";
import { PopPartyInstance } from "~/lib/cothority/personhood/pop-party-instance";
import { PopDesc } from "~/lib/cothority/personhood/proto";
import { Badge } from "~/lib/dynacred/Badge";
import { Party } from "~/lib/dynacred/Party";
import { partyQrcode } from "~/lib/qrcode";
import {uData} from "~/user-data";
import {GestureEventData} from "tns-core-modules/ui/gestures";
import {fromFile, ImageSource} from "tns-core-modules/image-source";
import {elements} from "~/pages/lab/personhood/personhood-page";
import {Folder, knownFolders, path} from "tns-core-modules/file-system";
import {sprintf} from "sprintf-js";
import {msgFailed, msgOK} from "~/lib/messages";
import * as dialogs from "tns-core-modules/ui/dialogs";
import {getFrameById, topmost} from "tns-core-modules/ui/frame";
import {mainViewRegistered} from "~/main-page";

export class PersonhoodView extends Observable {
    parties: PartyView[] = [];
    badges: BadgeView[] = [];
    canAddParty: boolean;

    constructor() {
        super();
        this.updateBadges();
    }

    get elements(): ViewElement[] {
        return this.sortUnique(this.parties).concat(this.sortUnique(this.badges));
    }

    sortUnique(input: ViewElement[]): ViewElement[] {
        let c = input.map(i => i).sort((a, b) => a.desc.datetime.compare(b.desc.datetime) * -1);
        return c.filter((re, i) =>
            c.findIndex(r => r.desc.uniqueName == re.desc.uniqueName) == i);
    }

    async updateAddParty() {
        try {
            this.canAddParty = uData.spawnerInstance &&
                uData.personhoodPublished &&
                await uData.canPay(uData.spawnerInstance.struct.costParty.value);
        } catch (e) {
            Log.catch(e);
            this.canAddParty = false;
        }
    }

    updateBadges() {
        this.badges = uData.badges.map(b => new BadgeView(b))
            .sort((a, b) => a.desc.datetime.sub(b.desc.datetime).toNumber());
        this.notifyPropertyChange("elements", this.elements);
    }

    async updateParties() {
        await uData.updateParties();
        this.parties = uData.parties.map(p => new PartyView(p))
            .sort((a, b) => a.party.partyInstance.popPartyStruct.description.datetime.sub(
                b.party.partyInstance.popPartyStruct.description.datetime).toNumber());

        if (this.parties.length > 0) {
            this.parties[0].setChosen(true);
        }
        this.notifyPropertyChange("elements", this.elements);
    }

    setProgress(text: string = "", width: number = 0) {
        Log.lvl2("setting progress to", text, width);
        if (width == 0) {
            elements.set("networkStatus", null);
        } else {
            let color = "#308080;";
            if (width < 0) {
                color = "#a04040";
            }
            let pb = topmost().getViewById("progress_bar");
            if (pb) {
                pb.setInlineStyle("width:" + Math.abs(width) + "%; background-color: " + color);
            }
            elements.set("networkStatus", text);
        }
    }
}

interface ViewElement {
    desc: PopDesc;
    qrcode: ImageSource;
    icon: ImageSource;
    bgcolor: string;
    showDetails: boolean;
    nextStep: string;
    stepWidth: string;

    onTap(arg: GestureEventData)
}

function getImage(name: string): ImageSource {
    const folder: Folder = <Folder>knownFolders.currentApp();
    const folderPath: string = path.join(folder.path, "images", name);
    return <ImageSource>fromFile(folderPath);
}

export class BadgeView extends Observable {
    desc: PopDesc;
    showDetails = false;

    constructor(public badge: Badge) {
        super();
        this.desc = badge.party.partyInstance.popPartyStruct.description;
    }

    get qrcode(): ImageSource {
        return null;
    }

    get icon(): ImageSource {
        return getImage("icon-personhood-64.png");
    }

    get bgcolor(): string {
        return "badge";
    }

    get nextStep(): string {
        if (this.badge.mined) {
            return null;
        }
        if (uData.contact.isRegistered()) {
            return "Mine Coins";
        } else {
            return "Register on byzcoin";
        }
    }

    get stepWidth(): string {
        return null;
    }

    async onTap(arg: GestureEventData) {
        let p = this.badge.party.partyInstance.popPartyStruct.description;
        let details = [p.name, p.purpose, p.dateString, p.location].join("\n");
        if (this.badge.mined) {
            return msgOK(details, "Details for badge");
        }
        try {
            let registered = uData.contact.isRegistered();
            await this.badge.mine(uData, elements.setProgress);
            await msgOK("Successfully mined\n" + details, "Details for badge");
            if (!registered) {
                return mainViewRegistered(arg);
            }
        } catch (e) {
            Log.catch(e);
            await msgFailed("Couldn't mine:\n" + e.toString());
            this.badge.mined = true;
        }
        await uData.save();
        elements.setProgress();
        await this.notifyPropertyChange("nextStep", this.nextStep);
    }
}

export class PartyView extends Observable {
    desc: PopDesc;
    chosen: boolean;
    showDetails = true;
    qrCache: ImageSource = undefined;

    constructor(public party: Party) {
        super();
        this.desc = party.partyInstance.popPartyStruct.description;
    }

    get qrcode(): ImageSource {
        if (this.chosen &&
            this.party.state == PopPartyInstance.SCANNING &&
            !this.party.isOrganizer) {
            if (!this.qrCache) {
                this.qrCache = partyQrcode(uData.keyPersonhood._public,
                    this.party.partyInstance.popPartyStruct.description.name);
            }
            return this.qrCache;
        } else {
            this.qrCache = null;
        }
        return null;
    }

    get icon(): ImageSource {
        return null;
    }

    get bgcolor(): string {
        if (this.party.isOrganizer) {
            return "party-owner";
        }
        return this.chosen ? "party-participate" : "party-available";
    }

    get nextStep(): string {
        if (this.party.isOrganizer) {
            return ["Waiting for barrier point",
                "Scan attendees' public keys",
                "Finalize the party"][this.party.state - 1];
        }
        if (!this.chosen) {
            return null;
        }
        return ["Go to party",
            "Get your qrcode scanned",
            "Mining coins"][this.party.state - 1];
    }

    get stepWidth(): string {
        if (!this.chosen && !this.party.isOrganizer) {
            return null;
        }
        return sprintf("%d%%", (this.party.state * 25));
    }

    showQrcode(){
        topmost().showModal("pages/modal/modal-key", partyQrcode(uData.keyPersonhood._public,
            this.party.partyInstance.popPartyStruct.description.name),
            ()=>{}, false, false, false);
    }

    setChosen(c: boolean) {
        if (c) {
            elements.parties.forEach(p => p.setChosen(false));
        }
        this.chosen = c;
        ["bgcolor", "qrcode", "nextStep", "stepWidth"].forEach(
            key => this.notifyPropertyChange(key, this[key]));
    }

    async onTap(arg: GestureEventData) {
        let DELETE = "Delete Party";
        let BARRIER = "Activate Barrier Point";
        let SCAN = "Scan attendees";
        let FINALIZE = "Finalize Party";
        let actions = [];
        if (this.party.isOrganizer) {
            switch (this.party.state) {
                case 1:
                    actions.push(BARRIER);
                    break;
                case 2:
                    actions.push(SCAN);
                    actions.push(FINALIZE);
                    break;
                case 3:
                    break;
            }
        } else if (!this.chosen) {
            this.setChosen(true);
            return;
        }
        actions.push(DELETE);
        try {
            switch (await dialogs.action({
                title: "Action for " + this.party.partyInstance.popPartyStruct.description.name,
                cancelButtonText: "Don't do anything",
                actions: actions,
            })) {
                case DELETE:
                    if (await dialogs.confirm({
                        title: "Delete " + this.party.partyInstance.popPartyStruct.description.name,
                        message: "Are you sure to delete that party? There is no way back.",
                        okButtonText: "Delete Party",
                        cancelButtonText: "Cancel",
                    })) {
                        let index = uData.parties.findIndex(p => this.party == p);
                        uData.parties.splice(index, 1);
                        elements.setProgress("Updating parties", 50);
                        await elements.updateParties();
                        elements.setProgress("Parties updated", 100);
                        await uData.save();
                        elements.setProgress();
                    }
                    break;
                case BARRIER:
                    elements.setProgress("Activating Barrier Point", 50);
                    await this.party.partyInstance.activateBarrier([uData.keyIdentitySigner]);
                    elements.setProgress();
                    break;
                case SCAN:
                    return topmost().navigate({
                        moduleName: "pages/lab/personhood/scan-atts/scan-atts-page",
                        context: this.party,
                    });
                    break;
                case FINALIZE:
                    elements.setProgress("Finalizing party", 40);
                    await this.party.partyInstance.finalize([uData.keyIdentitySigner]);
                    if (this.party.partyInstance.popPartyStruct.state == PopPartyInstance.FINALIZED) {
                        elements.setProgress("Updating parties", 70);
                        await elements.updateParties();
                        await msgOK("Finalized the party");
                    } else {
                        elements.setProgress("Party finalized", 100);
                        await msgOK("Waiting for other organizers to finalize");
                    }
                    elements.setProgress();
            }

            this.setChosen(true);
        } catch (e) {
            await msgFailed("Error occured: " + e.toString());
        }
    }
}